import { View } from "../base"
import { postJSON, toggleHeadStyle } from "../util"
import { Post } from "../posts"
import { getModel } from "../state"

let panel: ModPanel,
	displayCheckboxes = localStorage.getItem("hideModCheckboxes") !== "true",
	checkboxStyler: (toggle: boolean) => void

// Moderation panel with various post moderation and other controls
export default class ModPanel extends View<null> {
	constructor() {
		checkboxStyler = toggleHeadStyle(
			"mod-checkboxes",
			".mod-checkbox{ display: inline; }"
		)

		super({ el: document.getElementById("moderation-panel") })
		panel = this
		new BanForm()
		new NotificationForm()

		this.el.querySelector("form").addEventListener("submit", e =>
			this.onSubmit(e))

		this.el
			.querySelector("select[name=action]")
			.addEventListener("change", () => this.onSelectChange(), {
				passive: true
			})
		this.inputElement("clear")
			.addEventListener("click", () => this.clearCheckboxes(), {
				passive: true,
			})

		const checkboxToggle = this.inputElement("showCheckboxes")
		checkboxToggle.checked = displayCheckboxes
		checkboxToggle.addEventListener(
			"change",
			e =>
				this.setVisibility((event.target as HTMLInputElement).checked),
			{ passive: true },
		)

		this.setVisibility(displayCheckboxes)
	}

	private setVisibility(on: boolean) {
		localStorage.setItem("hideModCheckboxes", (!on).toString())
		this.setSlideOut(on)
		checkboxStyler(on)
	}

	private async onSubmit(e: Event) {
		e.preventDefault()
		e.stopImmediatePropagation()

		const checked = this.getChecked(),
			models = [...checked].map(getModel)

		switch (this.getMode()) {
			case "deletePost":
				if (checked.length) {
					await this.postJSON("/api/delete-post", mapToIDs(models))
				}
				break
			case "spoilerImage":
				if (checked.length) {
					await this.postJSON("/api/spoiler-image", mapToIDs(models))
				}
				break
			case "deleteImage":
				if (checked.length) {
					await this.postJSON(
						"/api/delete-image",
						mapToIDs(models.filter(m => !!m.image)),
					)
				}
				break
			case "ban":
				if (checked.length) {
					const args = HidableForm.forms["ban"].vals()
					args["ids"] = mapToIDs(models)
					await this.postJSON("/api/ban", args)
				}
				break
			case "notification":
				const f = HidableForm.forms["notification"]
				await this.postJSON("/api/notification", f.vals())
				f.clear()
				break
		}
	}

	// Get selected post checkboxes
	private getChecked(): HTMLInputElement[] {
		return document
			.querySelectorAll(".mod-checkbox:checked") as HTMLInputElement[]
	}

	// Clear any selected post checkboxes
	private clearCheckboxes() {
		for (let el of this.getChecked()) {
			el.checked = false
		}
	}

	// Return current action mode
	private getMode(): string {
		return (this.el
			.querySelector(`select[name="action"]`) as HTMLInputElement)
			.value
	}

	// Post JSON to server and handle errors
	private async postJSON(url: string, data: {}) {
		const res = await postJSON(url, data)
		this.el.querySelector(".form-response").textContent =
			res.status === 200
				? ""
				: await res.text()
	}

	// Change additional input visibility on action change
	private onSelectChange() {
		HidableForm.show(this.getMode())
	}

	// Force panel to stay visible
	public setSlideOut(on: boolean) {
		this.el.classList.toggle("keep-visible", on)
	}
}

abstract class HidableForm extends View<null> {
	public static forms: { [id: string]: HidableForm } = {}
	public abstract vals(): any

	constructor(id: string) {
		super({ el: document.getElementById(id + "-form") })
		HidableForm.forms[id] = this
		this.toggleDisplay(false)
	}

	public toggleDisplay(on: boolean) {
		for (let el of this.el.getElementsByTagName("input")) {
			el.disabled = !on
		}
		this.el.classList.toggle("hidden", !on)
	}

	// Hide all displayed forms
	public static hideAll() {
		for (let id in HidableForm.forms) {
			HidableForm.forms[id].toggleDisplay(false)
		}
	}

	// Show a form by ID, if any
	public static show(id: string) {
		HidableForm.hideAll()
		const f = HidableForm.forms[id]
		if (f) {
			f.toggleDisplay(true)
		}
	}

	// Clear any text inputs
	public clear() {
		for (let el of this.el.querySelectorAll("input[type=text]")) {
			(el as HTMLInputElement).value = ""
		}
	}
}

// Ban input fields
class BanForm extends HidableForm {
	constructor() {
		super("ban")
	}

	// Get input field values
	public vals(): { [key: string]: any } {
		let duration = 0
		for (let el of this.el.querySelectorAll("input[type=number]")) {
			let times = 1
			switch (el.getAttribute("name")) {
				case "day":
					times *= 24
				case "hour":
					times *= 60
			}
			const val = parseInt((el as HTMLInputElement).value)
			if (val) { // Empty string parses to NaN
				duration += val * times
			}
		}

		const data = {
			duration,
			reason: this.inputElement("reason").value,
		}
		const g = this.inputElement("global")
		if (g) {
			data["global"] = g.checked
		}
		return data
	}
}

// Form for sending notifications to all connected clients
class NotificationForm extends HidableForm {
	constructor() {
		super("notification")
	}

	public vals(): string {
		return this.inputElement("notification").value
	}
}

function mapToIDs(models: Post[]): number[] {
	return models.map(m =>
		m.id)
}
