/**
 * Client-Side Voice Activity Synchronization
 *
 * This module handles voice activity packets from the server and applies
 * corresponding lip-sync animations to remote players.
 *
 * Expected to be implemented in:
 * - Papyrus scripts (YacaBridgeQuest or equivalent)
 * - SkyrimPlatform TypeScript scripts (client-side gamemode)
 */

/**
 * Server sends this packet when a player's voice activity changes.
 * Client receives and applies animation accordingly.
 *
 * Expected packet structure:
 */
interface VoiceActivityBroadcast {
  actorId: string;        // Skyrim actor ID
  isSpeaking: boolean;    // Is player speaking?
  voiceRange: number;     // Proximity distance
  providerId?: string;    // e.g., "yaca-ts", "discord-bot"
  timestamp: number;      // When state was captured
}

/**
 * Client-side implementation pattern (TypeScript / SkyrimPlatform)
 *
 * Place this in skymp5-client/src/ or equivalent client-side gamemode path.
 */

// Animation form IDs for idle dialogue (lip-sync)
const LIP_SYNC_ANIMATIONS = {
  // Lock animation (speaker is active)
  IDLE_DIALOGUE_LOCK: 0x0005B1B0,      // IdleDialogueLock
  IDLE_DIALOGUE_UNLOCK: 0x0005B1B1,    // IdleDialogueUnlock
  MOTION_DRIVEN_DIALOGUE_NEXT: 0x000A3EE9, // MotionDrivenDialogueNextClip
  
  // Alternative idle animations while speaking
  IDLE_DIALOGUE_LISTEN: 0x0005B1AE,    // IdleDialogueListenLoop
};

// Track active animations per actor for cleanup
const activeAnimations = new Map<string, NodeJS.Timeout>();

/**
 * Initialize voice activity listener on client.
 * Call this during client gamemode initialization.
 */
export function initializeClientVoiceSync(): void {
  console.log("[Voice Activity Client] Initializing voice sync...");

  // Register custom packet handler for voice activity updates
  mp.addEventListener("customPacket", (packet) => {
    if (packet.eventName === "syncVoiceActivity") {
      const broadcast = packet as any as VoiceActivityBroadcast;
      handleVoiceActivityBroadcast(broadcast);
    }
  });

  console.log("[Voice Activity Client] Voice sync initialized");
}

/**
 * Handle incoming voice activity broadcast from server.
 *
 * @param broadcast Voice activity state for a remote player
 */
function handleVoiceActivityBroadcast(broadcast: VoiceActivityBroadcast): void {
  const actor = Game.getFormFromUniqueID(broadcast.actorId) as Actor;
  
  if (!actor) {
    console.warn(`[Voice Activity Client] Actor not found: ${broadcast.actorId}`);
    return;
  }

  try {
    // Clear any existing animation timer for this actor
    const existingTimer = activeAnimations.get(broadcast.actorId);
    if (existingTimer) {
      clearTimeout(existingTimer);
      activeAnimations.delete(broadcast.actorId);
    }

    if (broadcast.isSpeaking) {
      // Start lip-sync animation
      applyLipSyncAnimation(actor, broadcast);
    } else {
      // Stop animation
      clearLipSyncAnimation(actor);
    }

    console.log(
      `[Voice Activity Client] ${actor.getName()} (${broadcast.actorId}): ` +
      `${broadcast.isSpeaking ? "speaking" : "quiet"} (range: ${broadcast.voiceRange}m)`
    );
  } catch (err) {
    console.error("[Voice Activity Client] Error handling broadcast:", err);
  }
}

/**
 * Apply lip-sync animation to a speaking actor.
 *
 * @param actor The remote player
 * @param broadcast Voice activity state
 */
function applyLipSyncAnimation(actor: Actor, broadcast: VoiceActivityBroadcast): void {
  // Play the lock animation (actor stays in speaking pose)
  const lockForm = Game.getForm(LIP_SYNC_ANIMATIONS.IDLE_DIALOGUE_LOCK);
  if (!lockForm) {
    console.warn("[Voice Activity Client] Could not find IdleDialogueLock animation");
    return;
  }

  // Play animation
  actor.playIdle(lockForm as Idle);

  // Optional: Add animation refresh timer to keep it playing
  // (in case the engine kills it after a few seconds)
  const refreshTimer = setTimeout(() => {
    if (actor && actor.isValid()) {
      const currentState = actor.getAnimationVariableFloat("IdleDialogueLock");
      if (currentState === 0) {
        // Animation was interrupted, replay
        actor.playIdle(lockForm as Idle);
      }
    }
    // Recursively refresh every 2 seconds while speaking
    activeAnimations.set(broadcast.actorId, refreshTimer);
  }, 2000);

  activeAnimations.set(broadcast.actorId, refreshTimer);
}

/**
 * Clear lip-sync animation from an actor.
 * Returns actor to normal idle/movement state.
 *
 * @param actor The remote player
 */
function clearLipSyncAnimation(actor: Actor): void {
  try {
    // Stop any playing idle animation
    actor.stopTranslation();

    // Optional: If you want a specific "unlock" animation:
    // const unlockForm = Game.getForm(LIP_SYNC_ANIMATIONS.IDLE_DIALOGUE_UNLOCK);
    // actor.playIdle(unlockForm as Idle);
  } catch (err) {
    console.error("[Voice Activity Client] Error clearing animation:", err);
  }
}

/**
 * Optional: Shutdown client voice sync on disconnect.
 * Call this during server disconnect or client shutdown.
 */
export function shutdownClientVoiceSync(): void {
  console.log("[Voice Activity Client] Shutting down voice sync...");

  // Clear all active animation timers
  for (const [actorId, timer] of activeAnimations.entries()) {
    clearTimeout(timer);
  }
  activeAnimations.clear();

  console.log("[Voice Activity Client] Shutdown complete");
}

/**
 * Client-side Papyrus implementation pattern.
 *
 * In Papyrus (e.g., YacaBridgeQuest or custom quest script):
 *
 * ```papyrus
 * ; Receive voice activity update from server
 * Event OnVoiceActivitySync(string actorId, bool isSpeaking, float voiceRange)
 *   Actor actor = Game.GetFormFromUniqueID(actorId) as Actor
 *   if actor == None
 *     Debug.Trace("[Voice] Actor not found: " + actorId)
 *     return
 *   endif
 *   
 *   if isSpeaking
 *     ; Play lip-sync animation
 *     Idle lockAnim = Game.GetForm(0x0005B1B0) as Idle ; IdleDialogueLock
 *     actor.PlayIdle(lockAnim)
 *   else
 *     ; Stop animation
 *     actor.StopTranslation()
 *   endif
 * EndEvent
 * ```
 */

/**
 * Advanced: Voice effect synchronization (optional, future enhancement)
 *
 * Could include:
 * - Muffled/distorted audio if speaker is underwater
 * - Reverb if in large dungeon
 * - Echo if shouting (for dragon communications)
 * - Racial effects (e.g., ghostly voice for vampires)
 */
export interface VoiceEffect {
  type: "muffled" | "reverb" | "echo" | "distortion" | "racial";
  intensity: number; // 0.0 - 1.0
}

/**
 * Apply optional voice effects during lip-sync.
 * (Not yet implemented; requires audio plugin integration)
 *
 * @param actor Target actor
 * @param effect Voice effect to apply
 */
export function applyVoiceEffect(actor: Actor, effect: VoiceEffect): void {
  // TODO: Implement once audio effects API is available
  console.log(`[Voice Activity Client] Voice effect ${effect.type} would be applied`);
}
