// Traduit les événements du moteur en phrases courtes pour le journal et les animations.

import type { GameEvent, GameView, PlayerId, SideState } from '@chasseurs/engine';
import { TEAMS } from '@chasseurs/protocol';
import { equipmentName, monsterName, SLOT_LABELS, specialName } from './cards.ts';

export type Tone = 'info' | 'hit' | 'kill' | 'magic' | 'blocked' | 'reward';

export interface Line {
  text: string;
  tone: Tone;
  /** Emplacement du plateau concerné, pour l'animer. */
  slot?: number;
}

export function sideLabel(side: Pick<SideState, 'isTeam' | 'name'>): string {
  return side.isTeam ? (TEAMS.find((t) => t.id === side.name)?.name ?? side.name) : side.name;
}

export function makeNames(view: GameView, me: PlayerId | null) {
  const players = new Map(view.players.map((p) => [p.id, p.name]));
  const sides = new Map(view.sides.map((s) => [s.id, sideLabel(s)]));
  const name = (id: PlayerId) => players.get(id) ?? '?';
  return {
    /** Nom seul (« Toi » pour le joueur de cet appareil), pour les listes. */
    player: (id: PlayerId) => (id === me ? 'Toi' : name(id)),
    /** Sujet + verbe conjugué : « Alice abat » / « Tu abats ». */
    subject: (id: PlayerId, verb: string, verbTu: string) => (id === me ? `Tu ${verbTu}` : `${name(id)} ${verb}`),
    /** Complément : « Alice » / « toi ». */
    object: (id: PlayerId) => (id === me ? 'toi' : name(id)),
    side: (id: string) => sides.get(id) ?? '?',
  };
}

type Names = ReturnType<typeof makeNames>;

// Les phrases évitent d'accorder avec le nom du monstre (« la Sorcière », « le Golem »…).
export function describe(event: GameEvent, names: Names): Line | null {
  const { player, subject, object } = names;
  const where = (slot: number) => SLOT_LABELS[slot as 0 | 1 | 2].toLowerCase();
  switch (event.type) {
    case 'roundStarted':
      return { text: `Manche ${event.round}`, tone: 'info' };
    case 'bidsRevealed':
      return { text: `Ordre de passage : ${event.order.map(player).join(', ')}`, tone: 'info' };
    case 'shieldRaised':
      return { text: `${subject(event.playerId, 'lève', 'lèves')} le Bouclier du héros`, tone: 'magic' };
    case 'effectBlocked':
      return {
        text: `Le Bouclier de ${object(event.playerId)} bloque ${object(event.sourcePlayerId)}`,
        tone: 'blocked',
      };
    case 'actionCancelled':
      return {
        text: `${subject(event.byPlayerId, 'annule', 'annules')} l'action de ${object(event.playerId)}`,
        tone: 'magic',
      };
    case 'orderSwapped':
      return {
        text: `${subject(event.playerId, 'prend', 'prends')} la place de ${object(event.withPlayerId)}`,
        tone: 'magic',
      };
    case 'enchanted':
      return {
        text: `${subject(event.playerId, 'envoûte', 'envoûtes')} ${object(event.targetPlayerId)} (${where(event.slot)})`,
        tone: 'magic',
      };
    case 'actionRevealed': {
      const { equipment, special, boost } = event.plan;
      const cards = [
        equipment && equipmentName(equipment.card),
        special && specialName(special.card),
        boost > 0 && `+${boost} 🪙`,
      ].filter(Boolean);
      if (cards.length === 0) return null;
      return { text: `${player(event.playerId)} : ${cards.join(' · ')}`, tone: 'info' };
    }
    case 'monsterNetted':
      return { text: `Filet sur ${monsterName(event.monsterId)}`, tone: 'magic', slot: event.slot };
    case 'monsterHit':
      return event.cause === 'poison-tick'
        ? { text: `Le poison ronge ${monsterName(event.monsterId)}`, tone: 'hit', slot: event.slot }
        : { text: `${monsterName(event.monsterId)} encaisse le coup`, tone: 'hit', slot: event.slot };
    case 'attackLost':
      return { text: `L'attaque de ${object(event.playerId)} se perd`, tone: 'blocked', slot: event.slot };
    case 'monsterFrozen':
      return { text: `Le givre saisit ${monsterName(event.monsterId)}`, tone: 'magic', slot: event.slot };
    case 'monsterProtected':
      return {
        text: `La glace de ${object(event.playerId)} protège ${monsterName(event.monsterId)}`,
        tone: 'magic',
        slot: event.slot,
      };
    case 'protectionEnded':
      return { text: `La glace autour de ${monsterName(event.monsterId)} fond`, tone: 'info' };
    case 'damageBlocked':
      return {
        text: `La glace protège ${monsterName(event.monsterId)} : sans effet`,
        tone: 'blocked',
        slot: event.slot,
      };
    case 'monsterPoisoned':
      return { text: `Poison sur ${monsterName(event.monsterId)}`, tone: 'magic', slot: event.slot };
    case 'effectScheduled':
      return {
        text:
          event.card === 'charge-abomination'
            ? `${subject(event.playerId, 'prépare', 'prépares')} une Charge (${where(event.slot)})`
            : event.card === 'envoutement'
              ? `${subject(event.playerId, 'envoûte', 'envoûtes')} ${event.monsterId ? monsterName(event.monsterId) : 'le vide'}`
              : `La morsure de ${object(event.playerId)} continuera`,
        tone: 'magic',
        slot: event.slot,
      };
    case 'effectTriggered':
      return { text: `${equipmentName(event.card)} de ${object(event.playerId)} se déclenche`, tone: 'magic' };
    case 'monsterKilled': {
      const rewards = event.rewards.length > 0 ? ` · ${event.rewards.map(equipmentName).join(', ')}` : '';
      return {
        text: `${subject(event.playerId, 'abat', 'abats')} ${monsterName(event.monsterId)} ! +${event.points} PV${rewards}`,
        tone: 'kill',
        slot: event.slot,
      };
    }
    case 'monsterRevealed':
      return { text: `${monsterName(event.monsterId)} surgit`, tone: 'info', slot: event.slot };
    case 'hunterMarked':
      return { text: `Marque du chasseur : +${event.points} PV pour ${object(event.playerId)}`, tone: 'reward' };
    case 'coinGained':
      return { text: `${subject(event.playerId, 'gagne', 'gagnes')} ${event.amount} pièce`, tone: 'reward' };
    case 'specialAwarded':
      return {
        text: `${subject(event.playerId, 'gagne', 'gagnes')} ${event.card ? specialName(event.card) : 'une carte Spéciale'}`,
        tone: 'reward',
      };
    case 'specialDeckEmpty':
      return { text: 'Plus aucune carte Spéciale', tone: 'info' };
    case 'gameOver':
      return { text: 'Tous les monstres sont vaincus !', tone: 'kill' };
    default:
      return null;
  }
}
