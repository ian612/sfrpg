/**
 * A subclass of {@link foundry.data.fields.NumberField} which deals with distance data
 *
 * @property {number} min                 A minimum allowed value
 * @property {number} max                 A maximum allowed value
 * @property {number} step                A permitted step size
 * @property {boolean} integer=false      Must the number be an integer?
 * @property {boolean} positive=false     Must the number be positive?
 * @property {number[]|object|Function} [choices] An array of values or an object of values/labels which represent
 *                                        allowed choices for the field. A function may be provided which dynamically
 *                                        returns the array of choices.
 */
export default class SFRPGDistanceField extends foundry.data.fields.NumberField {
    /** @inheritdoc **/
    constructor(options = {}, context = {}) {
        super(options, context);
        // If choices are provided, the field should not be null by default
        if ( this.choices ) {
            this.nullable = options.nullable ?? false;
        }
        if ( Number.isFinite(this.min) && Number.isFinite(this.max) && (this.min > this.max) ) {
            throw new Error("NumberField minimum constraint cannot exceed its maximum constraint");
        }
    }

    /** @inheritdoc */
    static get _defaults() {
        return Object.assign(super._defaults, {
            nullable: true,
            min: 0,
            max: undefined,
            step: 0.5,
            integer: false,
            positive: false,
            choices: undefined
        });
    }
};
