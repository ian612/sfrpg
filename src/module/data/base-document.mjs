import SFRPGModifier from "../modifiers/modifier.js";
import SFRPGDistanceField from "./fields/distance-field.mjs";

const { fields } = foundry.data;

export default class SFRPGDocumentBase extends foundry.abstract.TypeDataModel {
    static migrateData(data) {
        data = SFRPGDocumentBase.#convertMeasurementUnits(data); // convert between metric/imperial units if needed
        return super.migrateData(data);
    }

    static defineSchema() {
        const schema = {};
        schema.slug = new fields.StringField({
            initial: "",
            blank: true,
            required: false,
            label: "SFRPG.Slug",
            hint: "SFRPG.SlugTooltip"
        });
        schema.measurementUnits = new fields.StringField({
            initial: "imperial",
            choices: [...Object.keys(CONFIG.SFRPG.measurementUnits)],
            required: true,
            label: "SFRPG.MeasurementUnits",
            hint: "SFRPG.MeasurementUnitsTooltip"
        });
        return schema;
    }

    static damagePartTemplate() {
        return {
            name: new fields.StringField({
                initial: "",
                blank: true
            }),
            formula: new fields.StringField({
                initial: "",
                blank: true
            }),
            types: new fields.SchemaField(
                Object.keys(CONFIG.SFRPG.damageAndHealingTypes).reduce((obj, type) => {
                    obj[type] = new fields.BooleanField({initial: false, required: false});
                    return obj;
                }, {}),
                {required: false}
            ),
            group: new fields.NumberField({
                initial: null,
                min: 0,
                integer: true,
                nullable: true
            }),
            isPrimarySection: new fields.BooleanField()
        };
    }

    static modifiersTemplate() {
        return {
            modifiers: new fields.ArrayField(
                new fields.EmbeddedDataField(SFRPGModifier),
                {required: true}
            )
        };
    }

    // TODO: Update all speeds to use this version of the template once migrations are implemented
    static _speedFieldData() {
        return {
            land: new fields.SchemaField({
                base: new SFRPGDistanceField({initial: 30, required: true})
            }),
            flying: new fields.SchemaField({
                base: new SFRPGDistanceField({initial: 0, required: true}),
                baseManeuverability: new fields.NumberField({initial: 0, min: -1, required: true})
            }),
            swimming: new fields.SchemaField({
                base: new SFRPGDistanceField({initial: 0, required: true})
            }),
            burrowing: new fields.SchemaField({
                base: new SFRPGDistanceField({initial: 0, required: true})
            }),
            climbing: new fields.SchemaField({
                base: new SFRPGDistanceField({initial: 0, required: true})
            }),
            special: new fields.StringField({initial: "", required: true}),
            mainMovement: new fields.StringField({initial: "land", required: true})
        };
    }

    static _getFieldsOfType(schema, fieldType, distanceFields) {
        for (const field of Object.values(schema.fields)) {
            if (field instanceof fieldType) {
                distanceFields.push(field.fieldPath.replace('system.', ''));
            } else if (field instanceof fields.SchemaField) {
                SFRPGDocumentBase._getFieldsOfType(field, fieldType, distanceFields);
            }
        }
    }

    static #convertMeasurementUnits(data) {
        const gameUnits = game.settings.get("sfrpg", "measurementUnits");
        if (data.measurementUnits === undefined) {
            data.measurementUnits = gameUnits;
            return data;
        }
        if (data.measurementUnits !== gameUnits) {
            const distanceFields = [];
            SFRPGDocumentBase._getFieldsOfType(this.schema, SFRPGDistanceField, distanceFields);
            if (distanceFields.length) {
                console.log(distanceFields);
            }
        }
        return data;
    }
}
