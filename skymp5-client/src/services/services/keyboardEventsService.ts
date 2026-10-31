import { DxScanCode } from '@skyrim-platform/skyrim-platform';

import { ClientListener, CombinedController, Sp } from './clientListener';

export class KeyboardEventsService extends ClientListener {
  constructor(private sp: Sp, private controller: CombinedController) {
    super();

    controller.on('update', () => this.onUpdate());
  }

  private onUpdate() {
    const current = new Map<DxScanCode, boolean>();
    this.controller.emitter.emit('queryKeyCodeBindings', {
      isDown: (binding: DxScanCode[]) => {
        for (const key of binding) current.set(key, this.sp.Input.isKeyPressed(key));
        return binding.every(key => current.get(key)) && binding.some(key => !this.previous.get(key));
      },
    });
    // Also sample bindings skipped by short-circuiting callers this frame.
    this.previous.forEach((_pressed, key) => {
      if (!current.has(key)) current.set(key, this.sp.Input.isKeyPressed(key));
    });
    this.previous = current;
  }

  private previous = new Map<DxScanCode, boolean>();
}
