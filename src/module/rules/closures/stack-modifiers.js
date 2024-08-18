import { Closure } from "../../engine/closure/closure.js";
import { SFRPGModifierType, SFRPGModifierTypes } from "../../modifiers/types.js";

/**
 * Takes an array of modifiers and "stacks" them.
 */
export default class StackModifiers extends Closure {
    /**
     * @override
     *
     * Takes a list of modifiers available to a roll and evaluates them, only making
     * available the highest modifier of each type to _process(). This method only processes
     * modifiers that are static, i.e. have no dice roll component. They can include statically
     * evaluated formulas.
     * Note: For situational modifiers with dice rolls involved, processAsync must be used.
     *
     * @param {Array}    modifiers The modifiers to stack.
     * @param {Context}  context   The context for this closure.
     * @param {Object}   options   Some options for this closure. e.g. we can provide the whole actor here.
     * @returns {Object}           An object containing only those modifiers allowed based on the stacking rules.
     */
    process(mods, context, options = { actor: null }) {
        // TODO: It might make sense to rename this to something like processStatic() to make
        // it more obvious what it's used for.
        const modifiers = mods;
        for (const modifier of modifiers) {
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
                    console.warn(`Could not calculate modifier: ${modifier.name} for actor: ${modifier.actor.name}. Setting to zero. ${error}`);
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
     * Functions similarly to process() but allows the evaluation of dice rolls prior to stacking,
     * so it is allowed to take situational modifiers.
     *
     * @param {Array}   mods    modifiers The modifiers to stack.
     * @param {Context} context The context for this closure.
     * @param {Object}  options Some options for this closure. F.e. we can provide the whole actor here.
     * @returns {Object}        An object containing only those modifiers allowed based on the stacking rules.
     */
    async processAsync(mods, context, options = { actor: null }) {
        // TODO: It might make sense to rename this to something like processDynamic() to make
        // it more obvious what it's used for.
        const modifiers = mods;
        if (modifiers.length > 0) {
            for (const modifier of modifiers) {
                const actor = options.actor;
                const formula = String(modifier.modifier);

                if (formula) {
                    const roll = Roll.create(formula, actor?.system);
                    let evaluatedRoll = {};
                    try {
                        evaluatedRoll = await roll.evaluate();
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
     * Plucks out the highest-value evaluated modifier from the list of modifiers available for
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
                case SFRPGModifierTypes.ABILITY:
                    prev[0].push(curr);
                    break;
                case SFRPGModifierTypes.ARMOR:
                    prev[1].push(curr);
                    break;
                case SFRPGModifierTypes.BASE:
                    prev[2].push(curr);
                    break;
                case SFRPGModifierTypes.CIRCUMSTANCE:
                    prev[3].push(curr);
                    break;
                case SFRPGModifierTypes.DIVINE:
                    prev[4].push(curr);
                    break;
                case SFRPGModifierTypes.ENHANCEMENT:
                    prev[5].push(curr);
                    break;
                case SFRPGModifierTypes.INSIGHT:
                    prev[6].push(curr);
                    break;
                case SFRPGModifierTypes.LUCK:
                    prev[7].push(curr);
                    break;
                case SFRPGModifierTypes.MORALE:
                    prev[8].push(curr);
                    break;
                case SFRPGModifierTypes.RACIAL:
                    prev[9].push(curr);
                    break;
                case SFRPGModifierTypes.RESISTANCE:
                    prev[11].push(curr);
                    break;
                case SFRPGModifierTypes.UNTYPED:
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
