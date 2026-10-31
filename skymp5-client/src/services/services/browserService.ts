// TODO: send event instead of direct dependency on FormView class
import {
  BrowserMessageEvent,
  DxScanCode,
  Menu,
  MenuCloseEvent,
  MenuOpenEvent,
} from 'skyrimPlatform';

import { FormView } from '../../view/formView';
import { QueryKeyCodeBindings } from '../events/queryKeyCodeBindings';
import { ClientListener, CombinedController, Sp } from './clientListener';
import { ChatBridge } from './chatBridge';
import { UiCoreBridge } from './uiCoreBridge';
import { PluginRuntimeLoader } from './pluginRuntimeLoader';

const unfocusEventString = `window.dispatchEvent(new CustomEvent('skymp5-client:browserUnfocused', {}))`;
const focusEventString = `window.dispatchEvent(new CustomEvent('skymp5-client:browserFocused', {}))`;

export class BrowserService extends ClientListener {
  private chat: Pick<ChatBridge, 'isPlaying' | 'open' | 'releaseOpenKey' | 'close'>;
  private ui: Pick<UiCoreBridge, 'isActive' | 'dismiss' | 'setAllowed'>;
  private modules: PluginRuntimeLoader;
  private uiFocused = false;
  private openingWithEnter = false;
  private sessionEnded = false;
  constructor(private sp: Sp, private controller: CombinedController) {
    super();

    this.sp.browser.setVisible(false);
    const emptyChat = { isPlaying: () => false, open: () => {}, releaseOpenKey: () => {}, close: () => this.releaseChatFocus() };
    const emptyUi = { isActive: () => false, dismiss: () => {}, setAllowed: (_allowed: boolean) => {} };
    // Keep the old protocol only for servers without the new package contract.
    const runtimeSettings = sp.settings['skymp5-client'] as any;
    const managedModules = runtimeSettings?.['plugin-runtime-api'] === 1 && runtimeSettings['plugin-runtime-managed'] !== false;
    this.chat = managedModules ? emptyChat : new ChatBridge(sp, controller, () => this.releaseChatFocus());
    this.ui = managedModules ? emptyUi : new UiCoreBridge(sp, controller, focused => this.onUiFocus(focused));
    this.modules = new PluginRuntimeLoader(sp, controller, {
      bindChat: bridge => { this.chat = bridge; return () => { if (this.chat === bridge) this.chat = emptyChat; }; },
      bindUi: bridge => { this.ui = bridge; return () => { if (this.ui === bridge) this.ui = emptyUi; }; },
      releaseChatFocus: () => this.releaseChatFocus(),
      focus: focused => this.onUiFocus(focused),
    });

    this.controller.emitter.on('queryKeyCodeBindings', (e) =>
      this.onQueryKeyCodeBindings(e),
    );
    this.controller.once('update', () => this.onceUpdate());
    this.controller.on('browserMessage', (e) => this.onBrowserMessage(e));
    this.controller.on('menuOpen', (e) => this.onMenuOpen(e));
    this.controller.on('menuClose', (e) => this.onMenuClose(e));
    this.controller.emitter.on('sessionEnded', event => {
      this.sessionEnded = event.active;
      if (event.active) {
        this.setPluginInteractionAllowed(false); this.chat.close(); this.uiFocused = false;
        this.sp.browser.setVisible(true); this.setFocus(true);
      }
    });
  }

  // TODO: keycodes should be configurable
  private onQueryKeyCodeBindings(e: QueryKeyCodeBindings) {
    if (this.sessionEnded) return;
    if (this.openingWithEnter && !this.sp.Input.isKeyPressed(DxScanCode.Enter)) {
      this.openingWithEnter = false;
      this.chat.releaseOpenKey();
    }
    if (e.isDown([DxScanCode.F1])) {
      if (!FormView.isNicknameDisplayServerControlled) {
        FormView.isDisplayingNicknames = !FormView.isDisplayingNicknames;
      }
    }
    if (e.isDown([DxScanCode.F2])) {
      if (this.canFocus()) {
        const visible = !this.sp.browser.isVisible();
        if (!visible) { this.setPluginInteractionAllowed(false); this.chat.close(); }
        else this.setPluginInteractionAllowed(true);
        this.sp.browser.setVisible(visible);
      }
    }
    if (this.uiFocused && e.isDown([DxScanCode.F6])) { if (!this.modules.dismiss()) this.ui.dismiss(); return; }
    if (this.canFocus() && e.isDown([DxScanCode.F6])) {
      const newState = !this.sp.browser.isFocused();
      if (newState) {
        this.setPluginInteractionAllowed(true);
        this.sp.browser.setVisible(true);
        this.setFocus(true);
        if (this.chat.isPlaying()) this.chat.open();
      } else {
        this.chat.close();
      }
    }
    if (this.canFocus() && e.isDown([DxScanCode.Enter]) && !this.sp.browser.isFocused()) {
      this.setPluginInteractionAllowed(true);
      this.sp.browser.setVisible(true);
      this.setFocus(true);
      if (this.chat.isPlaying()) {
        this.openingWithEnter = true;
        this.chat.open(true);
      }
    }
    if (e.isDown([DxScanCode.Escape])) {
      if (this.uiFocused) { if (!this.modules.dismiss()) this.ui.dismiss(); return; }
      if (this.sp.browser.isFocused()) {
        this.chat.close();
      }
    }
  }

  // One native focus owner: Skyrim menus > UI dialog > chat > gameplay.
  private releaseChatFocus() {
    if (this.sessionEnded) { this.setFocus(true); return; }
    if (!this.uiFocused) this.setFocus(false);
  }

  private onUiFocus(focused: boolean) {
    if (focused) {
      if (!this.canFocus() || (!this.ui?.isActive() && !this.modules?.isFocused())) return;
      this.uiFocused = true;
      this.chat.close();
      this.sp.browser.setVisible(true);
      this.setFocus(true);
    } else if (this.uiFocused) {
      this.uiFocused = false;
      this.setFocus(false);
    }
  }

  private setFocus(focused: boolean) {
    this.sp.browser.setFocused(focused);
    this.sp.browser.executeJavaScript(focused ? focusEventString : unfocusEventString);
  }

  private setPluginInteractionAllowed(allowed: boolean) {
    this.ui.setAllowed(allowed);
    this.modules.setAllowed(allowed);
  }

  private canFocus() {
    return !this.sessionEnded && this.badMenusOpen.size === 0 && !this.badMenus.some(menu => this.sp.Ui.isMenuOpen(menu));
  }

  private onceUpdate() {
    this.sp.browser.setVisible(this.canFocus());
  }

  private onBrowserMessage(e: BrowserMessageEvent) {
    const onFrontLoadedEventKey = 'front-loaded';

    if (e.arguments[0] === onFrontLoadedEventKey) {
      this.controller.emitter.emit('browserWindowLoaded', {});
    }
  }

  private onMenuOpen(e: MenuOpenEvent) {
    if (this.sessionEnded) { if (this.isBadMenu(e.name)) this.badMenusOpen.add(e.name); this.sp.browser.setVisible(true); this.setFocus(true); return; }
    if (this.isBadMenu(e.name)) {
      this.badMenusOpen.add(e.name);
      this.setPluginInteractionAllowed(false);
      this.chat.close();
      this.sp.browser.setVisible(false);
    } else if (e.name === Menu.HUD && this.badMenusOpen.size === 0) {
      this.sp.browser.setVisible(true);
      this.setPluginInteractionAllowed(this.canFocus());
    }
  }

  private onMenuClose(e: MenuCloseEvent) {
    if (this.sessionEnded) { this.badMenusOpen.delete(e.name); this.sp.browser.setVisible(true); this.setFocus(true); return; }
    if (this.badMenusOpen.delete(e.name)) {
      if (this.badMenusOpen.size === 0) {
        this.sp.browser.setVisible(true);
        this.setPluginInteractionAllowed(this.canFocus());
      }
    }

    if (e.name === Menu.HUD) {
      this.setPluginInteractionAllowed(false);
      this.chat.close();
      this.sp.browser.setVisible(false);
    }
  }

  private isBadMenu(menu: string) {
    return this.badMenus.includes(menu as Menu);
  }

  private badMenusOpen = new Set<string>();

  private readonly badMenus: Menu[] = [
    Menu.Barter,
    Menu.Book,
    Menu.Container,
    Menu.Crafting,
    Menu.Gift,
    Menu.Inventory,
    Menu.Journal,
    Menu.Lockpicking,
    Menu.Loading,
    Menu.Map,
    Menu.RaceSex,
    Menu.Stats,
    Menu.Tween,
    Menu.Console,
    Menu.Main,
    Menu.Dialogue,
    Menu.MessageBox,
    Menu.Favorites,
    Menu.Magic,
    Menu.Quantity,
    Menu.Training,
    Menu.Sleep,
    Menu.LevelUp,
  ];
}
