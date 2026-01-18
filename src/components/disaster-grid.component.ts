import { Component, output, ChangeDetectionStrategy } from '@angular/core';

@Component({
  selector: 'app-disaster-grid',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="grid grid-cols-2 gap-4 w-full max-w-md mx-auto">
      @for (item of disasters; track item.name) {
        <button 
          (click)="selectDisaster.emit(item.name)"
          class="relative overflow-hidden group bg-gray-800 hover:bg-red-900/40 border border-gray-700 hover:border-red-500 rounded-xl p-4 flex flex-col items-center justify-center transition-all duration-300 shadow-lg"
        >
          <div class="text-4xl mb-2 transform group-hover:scale-110 transition-transform duration-300">
            {{ item.icon }}
          </div>
          <span class="font-bold text-gray-200 group-hover:text-white uppercase tracking-wider text-sm text-center">
            {{ item.name }}
          </span>
          <!-- Active Indicator -->
          <div class="absolute inset-0 border-2 border-transparent group-hover:border-red-500/30 rounded-xl pointer-events-none"></div>
        </button>
      }
    </div>
  `
})
export class DisasterGridComponent {
  selectDisaster = output<string>();

  disasters = [
    { name: 'Earthquake', icon: '🏚️' },
    { name: 'Flood', icon: '🌊' },
    { name: 'Fire', icon: '🔥' },
    { name: 'Medical', icon: '🚑' },
    { name: 'Accident', icon: '💥' },
    { name: 'Violence', icon: '🛡️' },
    { name: 'Animal', icon: '🐍' },
    { name: 'Storm', icon: '🌪️' },
    { name: 'Chemical', icon: '☣️' },
    { name: 'Cyber', icon: '💻' },
    { name: 'Collapse', icon: '🏗️' },
    { name: 'Nuclear', icon: '☢️' },
  ];
}