import { logError, logTrace } from '../../logging';
import { MsgType } from '../../messages';
// TODO: refactor this out
import { localIdToRemoteId } from '../../view/worldViewMisc';
import { ClientListener, CombinedController, Sp } from './clientListener';
import { ConsoleSecurityClient } from './consoleSecurityClient';

enum CmdArgument {
  ObjectReference,
  BaseForm,
  Int,
  String,
}

type CmdName = 'additem' | 'equipitem' | 'placeatme' | 'disable' | 'mp';

export class ConsoleCommandsService extends ClientListener {
  private security: ConsoleSecurityClient;
  private registeredForwarded = new Set<string>();
  constructor(private sp: Sp, private controller: CombinedController) {
    super();
    this.security = new ConsoleSecurityClient(sp, controller);
    this.schemas = ConsoleCommandsService.createSchemas();
    this.setupMpCommand();
    this.setupVanilaCommands();
    this.security.installHooks(Array.from(this.registeredForwarded));
  }

  private static createSchemas() {
    const schemas = new Map<CmdName, CmdArgument[]>();
    schemas.set('additem', [
      CmdArgument.ObjectReference,
      CmdArgument.BaseForm,
      CmdArgument.Int,
    ]);
    schemas.set('equipitem', [
      CmdArgument.ObjectReference,
      CmdArgument.BaseForm,
    ]);
    schemas.set('placeatme', [
      CmdArgument.ObjectReference,
      CmdArgument.BaseForm,
    ]);
    schemas.set('disable', [CmdArgument.ObjectReference]);
    schemas.set('mp', [CmdArgument.ObjectReference, CmdArgument.String]);
    return schemas;
  }

  private setupMpCommand() {
    const command =
      this.sp.findConsoleCommand(' ConfigureUM') ||
      this.sp.findConsoleCommand('test');
    if (command === null) {
      logError(this, 'command was null in setupMpCommand');
      return;
    }

    command.shortName = 'mp';
    command.execute = this.getCommandExecutor('mp');
    this.registeredForwarded.add('disable');
  }

  private setupVanilaCommands() {
    logTrace(this, `Setting up vanila commands`);
    this.schemas.forEach((_, commandName) => {
      if (this.nonVanilaCommands.includes(commandName)) return;
      logTrace(this, `Setting up command`, commandName);
      const command = this.sp.findConsoleCommand(commandName);
      if (command === null) {
        logError(
          this,
          `command`,
          commandName,
          `was null in setupVanilaCommands`,
        );
        return;
      }
      if (this.nonVanilaCommands.includes(commandName)) {
        logTrace(this, `command`, commandName, ` is non-vanila command`);
        return;
      }
      command.execute = this.getCommandExecutor(commandName);
      this.registeredForwarded.add(commandName);
    });
    logTrace(this, `Vanila commands set up`);
  }

  private getCommandExecutor(
    commandName: CmdName,
  ): (...args: unknown[]) => boolean {
    return (...args: unknown[]) => {
      const operation = commandName === 'mp' ? 'disable' : commandName;
      if (commandName === 'mp' && (args.length !== 2 || typeof args[1] !== 'string' || args[1].toLowerCase() !== 'disable')) return false;
      if (!this.security.canForward(operation)) { this.security.deny(operation); return false; }
      // TODO: handle possible exceptions in this function
      const schema = this.schemas.get(commandName);
      if (schema === undefined) {
        logError(this, `Schema not found for command`, commandName);
        return false;
      }

      if (
        args.length !== schema.length
      ) {
        logError(
          this,
          `Mismatch found in the schema of`,
          commandName,
          `command`,
        );
        return false;
      }
      for (let i = 0; i < args.length; ++i) {
        switch (schema[i]) {
          case CmdArgument.ObjectReference:
            if (typeof args[i] !== 'number' || !Number.isSafeInteger(args[i]) || Number(args[i]) < 0 || Number(args[i]) > 0xffffffff) return false;
            try { args[i] = localIdToRemoteId(Number(args[i])); } catch { return false; }
            break;
          case CmdArgument.BaseForm:
          case CmdArgument.Int:
            if (typeof args[i] !== 'number' || !Number.isSafeInteger(args[i]) || Number(args[i]) <= 0 || Number(args[i]) > (schema[i] === CmdArgument.Int ? 1000000 : 0xffffffff)) return false;
            break;
          case CmdArgument.String:
            if (typeof args[i] !== 'string' || String(args[i]).length > 64) return false;
            break;
        }
      }

      for (let i = 0; i < args.length; ++i) {
        if (typeof args[i] !== 'string' && typeof args[i] !== 'number') {
          logError(
            this,
            `Bad argument type in command`,
            commandName,
            `argument index`,
            i,
          );
          return false;
        }
      }

      this.controller.emitter.emit('sendMessage', {
        message: {
          t: MsgType.ConsoleCommand,
          data: {
            commandName,
            args: args as (string | number)[],
          },
        },
        reliability: 'reliable',
      });

      // Meant to be shown to user, not for logging
      this.sp.printConsole('sent');
      return false;
    };
  }

  private readonly schemas: Map<CmdName, CmdArgument[]>;
  private readonly nonVanilaCommands = ['mp'];
}
