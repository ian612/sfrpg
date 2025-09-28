import { SFRPGEffectType, SFRPGModifierType } from "../../../modifiers/types.js";

export default function(engine) {
    engine.closures.add('calculateSkillModifiers', (fact, context) => {
        const data = fact.data;
        const skills = fact.data.skills;
        const modifiers = fact.modifiers;

        const filteredMods = modifiers.filter(mod => {
            return (mod.enabled || mod.modifierType === "formula") && [SFRPGEffectType.ABILITY_SKILLS, SFRPGEffectType.SKILL, SFRPGEffectType.ALL_SKILLS].includes(mod.effectType);
        });

        // Skills
        for (const [skl, skill] of Object.entries(skills)) {
            skill.rolledMods = [];
            const mods = context.parameters.stackModifiers.process(filteredMods.filter(mod => {
                const isRelevantMod = (mod.effectType === SFRPGEffectType.ALL_SKILLS)
                    || (mod.effectType === SFRPGEffectType.SKILL && skl === mod.valueAffected)
                    || (mod.effectType === SFRPGEffectType.ABILITY_SKILLS && skill.ability === mod.valueAffected);

                // temporary workaround to fix modifiers with mod "0" if the situational mod is higher.
                if (mod.modifierType === SFRPGModifierType.FORMULA && isRelevantMod) {
                    skill.rolledMods.push({mod: mod.modifier, bonus: mod});
                    return false;
                } else {
                    return isRelevantMod ? true : false;
                }
            }), context, {actor: fact.actor});

            const bonus = calculateBonus(mods, data, skill);

            skill.mod += bonus;
        }

        return fact;
    }, { required: ["stackModifiers"], closureParameters: ["stackModifiers"] });
}

function addModifier(bonus, data, item, localizationKey) {
    if (!item.calculatedMods) item.calculatedMods = [];
    item.calculatedMods.push({mod: bonus.modifier, bonus: bonus});
    const computedBonus = bonus.max || 0;

    if (computedBonus !== 0 && localizationKey) {
        item.tooltip.push(game.i18n.format(localizationKey, {
            type: game.i18n.format(`SFRPG.ModifierType${bonus.type.capitalize()}`),
            mod: computedBonus.signedString(),
            source: bonus.name
        }));
    }

    return computedBonus;
}

function calculateBonus(mods, data, skill) {
    let sum = 0;
    for (const bonuses of Object.values(mods)) {
        if (bonuses.length === 0) continue;
        for (const bonus of bonuses) {
            sum += addModifier(bonus, data, skill, "SFRPG.SkillModifierTooltip");
        }
    }
    return sum;
}
