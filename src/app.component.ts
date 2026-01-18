import { Component, inject, signal, computed, ViewChild, ElementRef, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DisasterGridComponent } from './components/disaster-grid.component';
import { LocationService, GeoLocationState } from './services/location.service';
import { GeminiService, EmergencyResource } from './services/gemini.service';

type ViewState = 'home' | 'assessing' | 'protocol' | 'chat';

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DisasterGridComponent],
  templateUrl: './app.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements OnInit {
  private locationService = inject(LocationService);
  private geminiService = inject(GeminiService);

  // Signals
  viewState = signal<ViewState>('home');
  selectedDisaster = signal<string>('');
  
  locationState = signal<GeoLocationState>(this.locationService.getInitialState());

  // Derived state for the UI
  mapQueryUrl = computed(() => {
    const s = this.locationState();
    if (s.coords) {
      return `https://www.google.com/maps/search/?api=1&query=${s.coords.latitude},${s.coords.longitude}`;
    }
    if (s.manualAddress) {
      return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(s.manualAddress)}`;
    }
    return '';
  });

  protocolResult = signal<string>('');
  nearbyResources = signal<EmergencyResource[]>([]);
  isGenerating = signal<boolean>(false);
  isLoadingResources = signal<boolean>(false);

  // Chat
  chatHistory = signal<ChatMessage[]>([]);
  isChatting = signal<boolean>(false);
  
  // Voice
  isVoiceSupported = signal<boolean>(false);
  isListening = signal<boolean>(false);
  recognition: any;

  @ViewChild('chatContainer') chatContainer!: ElementRef;
  @ViewChild('severityInput') severityInput!: ElementRef<HTMLTextAreaElement>;

  ngOnInit() {
    this.initVoice();
  }

  initVoice() {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    
    if (SpeechRecognition) {
      this.isVoiceSupported.set(true);
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.lang = 'en-US';
      this.recognition.interimResults = false;

      this.recognition.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        if (text) {
          this.sendMessage(text);
        }
        this.isListening.set(false);
      };

      this.recognition.onerror = (event: any) => {
        console.error('Speech recognition error', event.error);
        this.isListening.set(false);
      };
      
      this.recognition.onend = () => {
         this.isListening.set(false);
      };
    }
  }

  toggleVoice() {
    if (!this.isVoiceSupported()) return;

    if (this.isListening()) {
      this.recognition?.stop();
      this.isListening.set(false);
    } else {
      try {
        this.recognition?.start();
        this.isListening.set(true);
      } catch (e) {
        console.error('Unable to start voice recognition:', e);
        this.isListening.set(false);
      }
    }
  }

  // Navigation Logic
  startAssessment(disasterName: string) {
    this.selectedDisaster.set(disasterName);
    this.viewState.set('assessing');
    this.getLocation();
  }

  async getLocation() {
    // Reset state
    this.locationState.set({ 
      coords: null, 
      manualAddress: null,
      error: null, 
      loading: true, 
      isFallbackMode: false 
    });
    
    try {
      const coords = await this.locationService.getCurrentPosition();
      // Check if user cancelled or switched mode during wait
      if (!this.locationState().isFallbackMode) {
        this.locationState.set({ 
          coords, 
          manualAddress: null,
          error: null, 
          loading: false, 
          isFallbackMode: false 
        });
      }
    } catch (err: any) {
      // Auto-switch to manual mode on error
      this.enableManualEntry(err.toString());
    }
  }

  enableManualEntry(errorMsg: string | null = null) {
    this.locationState.update(s => ({
      ...s,
      loading: false,
      isFallbackMode: true,
      error: errorMsg,
      coords: null,
      manualAddress: s.manualAddress || ''
    }));
  }

  retryLocation() {
    this.getLocation();
  }

  updateManualLocation(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.locationState.update(state => ({
      ...state,
      manualAddress: value
    }));
  }

  handleLocationEnter() {
    // When user hits enter on location input
    if (this.severityInput?.nativeElement) {
      this.severityInput.nativeElement.focus();
    }
  }

  quickFill(input: HTMLTextAreaElement, text: string) {
    input.value = text;
  }

  async generateProtocol(severity: string) {
    if (!severity.trim()) severity = "Situation Unknown. Need General Protocol.";
    
    this.isGenerating.set(true);
    this.isLoadingResources.set(true);
    this.nearbyResources.set([]); // clear old
    
    // Get location or user input if GPS failed
    let loc: {lat: number, lng: number} | string = "Unknown Location";
    const s = this.locationState();
    
    if (s.coords) {
      loc = { lat: s.coords.latitude, lng: s.coords.longitude };
    } else if (s.isFallbackMode && s.manualAddress) {
      loc = s.manualAddress;
    }
    
    // 1. Get Protocol
    // 2. Get Resources (Parallel)
    
    this.viewState.set('protocol'); // Switch immediately to show loading UI
    
    const [protocol, resources] = await Promise.all([
      this.geminiService.generateEmergencyProtocol(this.selectedDisaster(), loc, severity),
      this.geminiService.findNearbyResources(loc)
    ]);

    this.protocolResult.set(protocol);
    this.nearbyResources.set(resources);
    
    this.isGenerating.set(false);
    this.isLoadingResources.set(false);

    // Add to chat history context
    this.chatHistory.update(h => [
      ...h,
      { role: 'user', text: `EMERGENCY ALERT: ${this.selectedDisaster()}. Location: ${typeof loc === 'string' ? loc : JSON.stringify(loc)}. Info: ${severity}` },
      { role: 'model', text: protocol }
    ]);
  }

  resetApp() {
    this.viewState.set('home');
    this.selectedDisaster.set('');
    this.protocolResult.set('');
    this.nearbyResources.set([]);
    this.chatHistory.set([]);
  }

  skipToChat() {
    this.viewState.set('chat');
  }

  enterChatMode() {
    this.viewState.set('chat');
  }

  // Chat Logic
  async sendMessage(text: string) {
    if (!text.trim()) return;

    this.chatHistory.update(h => [...h, { role: 'user', text }]);
    this.isChatting.set(true);

    // Prepare history for API
    const apiHistory = this.chatHistory().map(msg => ({
      role: msg.role,
      parts: [{ text: msg.text }]
    }));

    // We remove the last user message we just added from apiHistory
    apiHistory.pop(); 
    
    const responseText = await this.geminiService.chatWithProfessional(
      apiHistory, // send context
      text // send current message
    );

    this.chatHistory.update(h => [...h, { role: 'model', text: responseText }]);
    this.isChatting.set(false);
    
    setTimeout(() => {
      if(this.chatContainer) {
        this.chatContainer.nativeElement.scrollTop = this.chatContainer.nativeElement.scrollHeight;
      }
    }, 100);
  }
}