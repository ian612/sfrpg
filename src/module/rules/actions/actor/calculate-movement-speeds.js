import { SFRPG } from "../../../config.js";
import { SFRPGEffectType, SFRPGModifierType, SFRPGModifierTypes } from "../../../modifiers/types.js";

export default function(engine) {
    engine.closures.add( "calculateMovementSpeeds", (fact, context) => {
        const data = fact.data;
        const speed = data.attributes.speed;
        const armors = fact.armors?.length > 0 ? fact.armors : null;
        const speedTooltip = [];

        // Calculate the armor with the largest speed penalty
        const slowestArmor = armors?.reduce((armor, worstArmor) => (armor.system?.armor?.speedAdjust || 0) < (worstArmor.system?.armor?.speedAdjust || 0) ? armor : worstArmor);
        const armorSpeed = {value: slowestArmor?.system?.armor?.speedAdjust || 0};
        if (armorSpeed.value) {
            armorSpeed.tooltip = [];
            armorSpeed.tooltip.push(game.i18n.format("SFRPG.ActorSheet.Modifiers.Tooltips.Speed", {
                speed: game.i18n.localize("SFRPG.ActorSheet.Attributes.Speed.Types.All"),
                type: SFRPG.modifierTypes["armor"],
                mod: armorSpeed.value.signedString(),
                source: slowestArmor.name
            }));
        }

        // Stack multiplicative modifiers
        const filteredMultiplyModifiers = fact.modifiers.filter(mod => {
            return (mod.enabled || mod.modifierType === "formula") && mod.effectType === SFRPGEffectType.MULTIPLY_ALL_SPEEDS;
        });
        const stackFilteredMultiplyModifiers = context.parameters.stackModifiers.process(filteredMultiplyModifiers, context, {actor: fact.actor});

        // Calculate the speed multiplier
        const [speedMultiplier, multiplierTooltip] = calculateMultiplier(data, stackFilteredMultiplyModifiers);

        // Calculate speed bonuses & penalties from additive modifiers
        for (const speedKey of Object.keys(SFRPG.speeds)) {
            if (speedKey === "special") {
                continue;
            }

            // Stack additive modifiers
            const filteredModifiers = fact.modifiers.filter(mod => {
                return (mod.enabled || mod.modifierType === "formula") && (mod.effectType === SFRPGEffectType.ALL_SPEEDS || (mod.effectType === SFRPGEffectType.SPECIFIC_SPEED && mod.valueAffected === speedKey));
            });
            const stackFilteredModifiers = context.parameters.stackModifiers.process(filteredModifiers, context, {actor: fact.actor});

            // Calculate speed prior to any speed multiplication modifiers
            const baseValue = Number(speed[speedKey].base);
            const bonus = calculateBonus(data, armorSpeed, stackFilteredModifiers, speedKey, speedTooltip);
            const speedIntermediate = Math.max(0, baseValue + bonus);

            // Set the final calculated speed
            if (!game.settings.get("sfrpg", "decimalSpeed")) {
                speed[speedKey].value = Math.floor(speedIntermediate * speedMultiplier);
            } else {
                speed[speedKey].value = speedIntermediate * speedMultiplier;
            }

            if (speedKey === "flying") {
                speed[speedKey].maneuverability = speed[speedKey].baseManeuverability;
            }
        }

        // Push speed tooltips
        speed.tooltip = [...armorSpeed.tooltip, ...speedTooltip, ...multiplierTooltip];

        return fact;
    }, { required: ["stackModifiers"], closureParameters: ["stackModifiers"] } );
}

function addModifier(bonus, data, localizationKey, speedKey, speedTooltip) {
    const speed = data.attributes.speed;
    if (bonus.modifierType === SFRPGModifierType.FORMULA) {
        if (speed.rolledMods) {
            speed.rolledMods.push({mod: bonus.modifier, bonus: bonus});
        } else {
            speed.rolledMods = [{mod: bonus.modifier, bonus: bonus}];
        }

        return 0;
    } else {
        const roll = Roll.create(bonus.modifier.toString(), data).evaluateSync({strict: false});
        const computedBonus = roll.total;

        // Add a tooltip if needed
        if (computedBonus !== 0 && localizationKey) {
            const isAllSpeeds = bonus.effectType === SFRPGEffectType.ALL_SPEEDS;
            const addTooltip = ((isAllSpeeds && speedKey === "land") || !isAllSpeeds);
            const speedLabel = isAllSpeeds ? game.i18n.format("SFRPG.ActorSheet.Attributes.Speed.Types.All") : SFRPG.speeds[speedKey];
            if (addTooltip) {
                speedTooltip.push(game.i18n.format(localizationKey, {
                    speed: speedLabel,
                    type: game.i18n.format(`SFRPG.ModifierType${bonus.type.capitalize()}`),
                    mod: computedBonus.signedString(),
                    source: bonus.name
                }));
            }
        }

        return computedBonus;
    }
}

function calculateBonus(data, armorSpeed, stackFilteredModifiers, speedKey, speedTooltip) {
    let sum = 0;
    let armorSpeedUsed = !armorSpeed.value ? true : false;
    for (let [bonusType, bonuses] of Object.entries(stackFilteredModifiers)) {
        if (bonuses === null || bonuses.length === 0) continue;
        if (![SFRPGModifierTypes.CIRCUMSTANCE, SFRPGModifierTypes.UNTYPED].includes(bonusType)) {
            bonuses = [bonuses];
        }

        for (const bonus of bonuses) {
            let value = addModifier(bonus, data, "SFRPG.ActorSheet.Modifiers.Tooltips.Speed", speedKey, speedTooltip);
            // For armor, compare armor penalty to bonus and take the greater of the two. Manipulate tooltips accordingly
            if (bonusType === "armor") {
                armorSpeedUsed = true;
                if (value < armorSpeed.value) {
                    // use the previously calculated value, remove the armor tooltip
                    armorSpeed.tooltip = [];
                } else {
                    // use the armor value and tooltip
                    value = armorSpeed.value;
                    speedTooltip.pop();
                }
            }
            sum += value;
        }
    }
    return armorSpeedUsed ? sum : sum + armorSpeed.value;
}

function calculateMultiplier(data, stackFilteredMultiplyModifiers) {
    const speed = data.attributes.speed;
    let totalMultiplier = 1;
    const multiplierTooltip = [];
    for (let [bonusType, bonuses] of Object.entries(stackFilteredMultiplyModifiers)) {
        if (bonuses === null || bonuses.length === 0) continue;
        if (![SFRPGModifierTypes.CIRCUMSTANCE, SFRPGModifierTypes.UNTYPED].includes(bonusType)) {
            bonuses = [bonuses];
        }

        for (const bonus of bonuses) {
            if (bonus.modifierType === SFRPGModifierType.FORMULA) {
                if (!speed.rolledMods) speed.rolledMods = [];
                speed.rolledMods.push({mod: bonus.modifier, bonus: bonus});
            } else {
                const roll = Roll.create(bonus.modifier.toString(), data).evaluateSync({strict: false});
                const computedBonus = roll.total;

                if (computedBonus !== 1) {
                    multiplierTooltip.push(game.i18n.format("SFRPG.ActorSheet.Modifiers.Tooltips.Speed", {
                        speed: game.i18n.format("SFRPG.ActorSheet.Attributes.Speed.Types.All"),
                        type: bonus.type.capitalize(),
                        mod: Math.floor(100 * computedBonus) + "%",
                        source: bonus.name
                    }));
                }
                totalMultiplier *= computedBonus;
            }
        }
    }
    return [totalMultiplier, multiplierTooltip];
}
