/**
 * A simple form to set actor movement speeds
 * @extends {DocumentSheet}
 */
export class ActorMovementConfig extends DocumentSheet {

    /** @override */
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            classes: ["sfrpg"],
            template: "systems/sfrpg/templates/apps/movement-config.hbs",
            width: 300,
            height: "auto"
        });
    }

    /* -------------------------------------------- */

    /** @override */
    get title() {
        return game.i18n.format("SFRPG.ActorSheet.Attributes.Speed.MovementSpeedNamedTitle", {name: this.document.name});
    }

    /* -------------------------------------------- */

    /** @override */
    getData(options) {
        return this.document;
    }
}
