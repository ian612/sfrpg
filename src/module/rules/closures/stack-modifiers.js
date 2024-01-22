import { Closure } from "../../engine/closure/closure.js";
import { SFRPGModifierType, SFRPGBonusTypes } from "../../modifiers/types.js";

/**
 * Takes an array of modifiers and "stacks" them.
 */
export default class StackModifiers extends Closure {
    /**
     * @override
     *
     * This method takes a list of modifiers available to a roll and evaluates them, only making
     * available the highest modifier of each type to _process. This method only processes
     * modifiers that are static, i.e. have no dice roll component. They can include statically
     * evaluated formulas.
     * For situational modifiers with dice rolls involved, processAsync must be used.
     *
     * @param {Array}    modifiers  The modifiers to stack.
     * @param {Context}  context    The context for this closure.
     * @param {Object}   options    Some options for this closure. e.g. we can provide the whole actor here.
     * @returns {Object}            An object containing only those modifiers allowed based on the stacking rules.
     */
    process(mods, context, options = { actor: null }) {
        const modifiers = mods;
        for (let modifiersI = 0; modifiersI < modifiers.length; modifiersI++) {
            const modifier = modifiers[modifiersI];
            const actor = options.actor;
            const formula = String(modifier.modifier);

            if (formula && (modifier.modifierType === SFRPGModifierType.CONSTANT)) {
                try {
                    const roll = Roll.create(formula, actor?.system);
                    if (roll.isDeterministic) {
                        const warn = game.settings.get("sfrpg", "warnInvalidRollData") || false;
                        const simplerFormula = Roll.replaceFormulaData(formula, actor?.system, {missing: 0, warn});
                        modifier.max = Roll.safeEval(simplerFormula);
                    } else {
                        ui.notifications.error(`Error with modifier: ${modifier.name}. Dice are not available in constant formulas. Please use a situational modifier instead.`);
                        modifier.max = 0;
                    }
                } catch (error) {
                    console.warn(`Could not calculate modifier: ${modifier.name} for actor with ID: ${modifier.container.actorUuid}. Setting to zero. ${error}`);
                    modifier.max = 0;
                }
            } else {
                modifier.max = 0;
                if (modifier.modifierType === SFRPGModifierType.FORMULA) {
                    console.warn(`Situational modifier: ${modifier.name} was found in constant modifier calculation. How did that end up in here?`);
                }
            }
        }
        return this._process(modifiers);
    }

    /**
     * This functions similarly to process(), but allows the evaluation of dice rolls and
     * situational modifiers before stacking.
     * @param   {Array}   mods    The modifiers to stack.
     * @param   {Context} context The context for this closure.
     * @param   {Object}  options Some options for this closure. e.g. we can provide the whole actor here.
     * @returns {Object}          An object containing only those modifiers allowed based on the stacking rules.
     */
    async processAsync(mods, context, options = { actor: null }) {
        const modifiers = mods;
        if (modifiers.length > 0) {
            // Loop through all the modifiers available to the stack
            for (const modifier of modifiers) {
                const actor = options.actor;
                const formula = String(modifier.modifier);

                if (formula) {
                    const roll = Roll.create(formula, actor?.system);
                    let evaluatedRoll = {};
                    try {
                        evaluatedRoll = await roll.evaluate({async: true});
                    } catch {
                        evaluatedRoll = {
                            total: 0,
                            dice: []
                        };
                    }
                    modifier.max = evaluatedRoll.total;
                    modifier.isDeterministic = roll.isDeterministic;
                    modifier.dices = [];

                    if (!roll.isDeterministic) {
                        for (let allDiceI = 0; allDiceI < evaluatedRoll.dice.length; allDiceI++) {
                            const die = evaluatedRoll.dice[allDiceI];
                            if (!die) continue;
                            modifier.dices.push({
                                formula: `${die.number}d${die.faces}`,
                                faces: die.faces,
                                total: die.results.reduce((pv, cv) => pv + cv.result, 0)
                            });
                        }
                    }
                } else {
                    modifier.max = 0;
                }
            }
        }
        return this._process(modifiers);
    }

    /**
     * Plucks out the highest valued evaluated modifier from the list of modifiers available for
     * the current roll/evaluation context, and returns them in an object.
     * @param {Array}    modifiers  The modifiers to process
     * @returns {Object}            The highest value modifier of each bonus type, plus all untyped modifiers
     */
    _process(modifiers) {
        const [abilityMods,
            armorMods,
            baseMods,
            circumstanceMods,
            divineMods,
            enhancementMods,
            insightMods,
            luckMods,
            moraleMods,
            racialMods,
            untypedMods,
            resistanceMods] = modifiers.reduce((prev, curr) => {
            switch (curr.type) {
                case SFRPGBonusTypes.ABILITY:
                    prev[0].push(curr);
                    break;
                case SFRPGBonusTypes.ARMOR:
                    prev[1].push(curr);
                    break;
                case SFRPGBonusTypes.BASE:
                    prev[2].push(curr);
                    break;
                case SFRPGBonusTypes.CIRCUMSTANCE:
                    prev[3].push(curr);
                    break;
                case SFRPGBonusTypes.DIVINE:
                    prev[4].push(curr);
                    break;
                case SFRPGBonusTypes.ENHANCEMENT:
                    prev[5].push(curr);
                    break;
                case SFRPGBonusTypes.INSIGHT:
                    prev[6].push(curr);
                    break;
                case SFRPGBonusTypes.LUCK:
                    prev[7].push(curr);
                    break;
                case SFRPGBonusTypes.MORALE:
                    prev[8].push(curr);
                    break;
                case SFRPGBonusTypes.RACIAL:
                    prev[9].push(curr);
                    break;
                case SFRPGBonusTypes.RESISTANCE:
                    prev[11].push(curr);
                    break;
                case SFRPGBonusTypes.UNTYPED:
                default:
                    prev[10].push(curr);
                    break;
            }

            return prev;
        }, [[], [], [], [], [], [], [], [], [], [], [], []]);

        const ability = abilityMods?.filter(mod => mod.max > 0)?.sort((a, b) => b.max - a.max)
            ?.shift() ?? null;
        const armor = armorMods?.sort((a, b) => b.max - a.max)?.shift() ?? null;
        const base = baseMods?.sort((a, b) => b.max - a.max)?.shift() ?? null;
        const circumstance = circumstanceMods?.sort((a, b) => b.max - a.max);
        const divine = divineMods?.sort((a, b) => b.max - a.max)?.shift() ?? null;
        const enhancement = enhancementMods?.sort((a, b) => b.max - a.max)?.shift() ?? null;
        const insight = insightMods?.sort((a, b) => b.max - a.max)?.shift() ?? null;
        const luck = luckMods?.sort((a, b) => b.max - a.max)?.shift() ?? null;
        const morale = moraleMods?.sort((a, b) => b.max - a.max)?.shift() ?? null;
        const racial = racialMods?.sort((a, b) => b.max - a.max)?.shift() ?? null;
        const resistance = resistanceMods?.sort((a, b) => b.max - a.max)?.shift() ?? null;
        const untyped = untypedMods?.sort((a, b) => b.max - a.max);

        return {
            ability,
            armor,
            base,
            circumstance,
            divine,
            enhancement,
            insight,
            luck,
            morale,
            racial,
            resistance,
            untyped
        };
    }
}
