/*	Popup/floating footnotes to avoid readers needing to scroll to the end of
	the page to see any footnotes; see
	http://ignorethecode.net/blog/2010/04/20/footnotes/ for details.
Original author:  Lukas Mathis (2010-04-20)
License: public domain ("And some people have asked me about a license for this piece of code. I think it’s far too short to get its own license, so I’m relinquishing any copyright claims. Consider the code to be public domain. No attribution is necessary.")
	*/
Popups = {
	/**********/
	/*	Config.
		*/
    popupContainerID: "popup-container",
    popupContainerParentSelector: "html",
    popupContainerZIndex: "10001",

    popupBreathingRoomX: 12.0,
    popupBreathingRoomY: 8.0,

    popupTriggerDelay: 200,
    popupFadeoutDelay: 50,
    popupFadeoutDuration: 250,

	/******************/
	/*	Implementation.
		*/
	popupFadeTimer: false,
	popupDespawnTimer: false,
	popupSpawnTimer: false,
	popupContainer: null,

	cleanup: () => {
		GWLog("Popups.cleanup", "popups.js", 1);

        //  Remove popups container and injected styles.
        document.querySelectorAll(`#${Popups.popupContainerID}`).forEach(element => element.remove());

		//  Remove Escape key event listener.
		document.removeEventListener("keyup", Popups.keyUp);
	},
	setup: () => {
		GWLog("Popups.setup", "popups.js", 1);

        //  Run cleanup.
        Popups.cleanup();

        //  Inject popups container.
        let popupContainerParent = document.querySelector(Popups.popupContainerParentSelector);
        if (!popupContainerParent) {
            GWLog("Popup container parent element not found. Exiting.", "popups.js", 1);
            return;
        }
        popupContainerParent.insertAdjacentHTML("beforeend", `<div 
        	id="${Popups.popupContainerID}" 
        	class="popup-container" 
        	style="z-index: ${Popups.popupContainerZIndex};"
        		></div>`);
        requestAnimationFrame(() => {
            Popups.popupContainer = document.querySelector(`#${Popups.popupContainerID}`);
        });

		//  Add Escape key event listener.
		document.addEventListener("keyup", Popups.keyUp = (event) => {
			GWLog("Popups.keyUp", "popups.js", 3);
			let allowedKeys = [ "Escape", "Esc" ];
			if (!allowedKeys.includes(event.key) || Popups.popupContainer.childElementCount == 0)
				return;

			event.preventDefault();

			[...Popups.popupContainer.children].forEach(popup => {
				Popups.despawnPopup(popup);
			});
		});

		GW.notificationCenter.fireEvent("Popups.setupDidComplete");
	},
	addTargetsWithin: (contentContainer, targets, prepareFunction, targetPrepareFunction = null) => {
		if (typeof contentContainer == "string")
			contentContainer = document.querySelector(contentContainer);

		if (contentContainer == null)
			return;

		//	Get all targets.
		contentContainer.querySelectorAll(targets.targetElementsSelector).forEach(target => {
			if (   target.closest(targets.excludedElementsSelector) == target
				|| target.closest(targets.excludedContainerElementsSelector) != null) {
				target.classList.toggle("no-popup", true);
				return;
			}

			if (!targets.testTarget(target)) {
				target.classList.toggle("no-popup", true);
				return;
			}

			//	Bind mouseenter/mouseleave events.
			target.addEventListener("mouseenter", Popups.targetMouseenter);
			target.addEventListener("mouseleave", Popups.targetMouseleave);

			//  Set prepare function.
			target.preparePopup = prepareFunction;

			//  Run any custom processing.
			if (targetPrepareFunction)
				targetPrepareFunction(target);

			//  Mark target as spawning a popup.
			target.classList.toggle("spawns-popup", true);
		});
	},
	addTargets: (targets, prepareFunction, targetPrepareFunction = null) => {
		GWLog("Popups.addTargets", "popups.js", 1);

		Popups.addTargetsWithin(document, targets, prepareFunction, targetPrepareFunction);
	},
	removeTargetsWithin: (contentContainer, targets, targetRestoreFunction = null) => {
		if (typeof contentContainer == "string")
			contentContainer = document.querySelector(contentContainer);

		if (contentContainer == null)
			return;

		contentContainer.querySelectorAll(targets.targetElementsSelector).forEach(target => {
			if (   target.closest(targets.excludedElementsSelector) == target
				|| target.closest(targets.excludedContainerElementsSelector) != null) {
				target.classList.toggle("no-popup", false);
				return;
			}

			if (!targets.testTarget(target)) {
				target.classList.toggle("no-popup", false);
				return;
			}

			//	Unbind existing mouseenter/mouseleave events, if any.
			target.removeEventListener("mouseenter", Popups.targetMouseenter);
			target.removeEventListener("mouseleave", Popups.targetMouseleave);

			//  Clear timers for target.
			Popups.clearPopupTimers(target);

			//  Remove spawned popup for target, if any.
			if (target.popup)
				Popups.despawnPopup(target.popup);

			//  Unset popup prepare function.
			target.preparePopup = null;

			//  Un-mark target as spawning a popup.
			target.classList.toggle("spawns-popup", false);

			//  Run any custom processing.
			if (targetRestoreFunction)
				targetRestoreFunction(target);
		});
	},
	removeTargets: (targets, targetRestoreFunction = null) => {
		GWLog("Popups.removeTargets", "popups.js", 1);

		Popups.removeTargetsWithin(document, targets, targetRestoreFunction);
	},

	/*	Returns true if the given element is currently visible.
		*/
	isVisible: (element) => {
		let containingPopup = element.closest(".popup");
		return (containingPopup ? isWithinRect(element, containingPopup.getBoundingClientRect()) : isOnScreen(element));
	},

	allSpawnedPopups: () => {
		return Array.from(Popups.popupContainer.children);
	},

	preferSidePositioning: (target) => {
		return target.preferSidePositioning ? target.preferSidePositioning() : false;
	},

	scrollElementIntoViewInPopFrame: (element) => {
		let popup = element.closest(".popup");
		popup.scrollView.scrollTop = element.getBoundingClientRect().top - popup.scrollView.getBoundingClientRect().top;
	},

	titleBarComponents: {
		popupPlaces: [ "left", "right", "top", "bottom", "top-left", "top-right", "bottom-left", "bottom-right" ],
		buttonIcons: {
			"close": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M325.8 193.8L263.6 256l62.2 62.2c4.7 4.7 4.7 12.3 0 17l-22.6 22.6c-4.7 4.7-12.3 4.7-17 0L224 295.6l-62.2 62.2c-4.7 4.7-12.3 4.7-17 0l-22.6-22.6c-4.7-4.7-4.7-12.3 0-17l62.2-62.2-62.2-62.2c-4.7-4.7-4.7-12.3 0-17l22.6-22.6c4.7-4.7 12.3-4.7 17 0l62.2 62.2 62.2-62.2c4.7-4.7 12.3-4.7 17 0l22.6 22.6c4.7 4.7 4.7 12.3 0 17zM448 80v352c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V80c0-26.5 21.5-48 48-48h352c26.5 0 48 21.5 48 48zm-48 346V86c0-3.3-2.7-6-6-6H54c-3.3 0-6 2.7-6 6v340c0 3.3 2.7 6 6 6h340c3.3 0 6-2.7 6-6z"/></svg>`,
			"maximize": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M0 180V56c0-13.3 10.7-24 24-24h124c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12H64v84c0 6.6-5.4 12-12 12H12c-6.6 0-12-5.4-12-12zM288 44v40c0 6.6 5.4 12 12 12h84v84c0 6.6 5.4 12 12 12h40c6.6 0 12-5.4 12-12V56c0-13.3-10.7-24-24-24H300c-6.6 0-12 5.4-12 12zm148 276h-40c-6.6 0-12 5.4-12 12v84h-84c-6.6 0-12 5.4-12 12v40c0 6.6 5.4 12 12 12h124c13.3 0 24-10.7 24-24V332c0-6.6-5.4-12-12-12zM160 468v-40c0-6.6-5.4-12-12-12H64v-84c0-6.6-5.4-12-12-12H12c-6.6 0-12 5.4-12 12v124c0 13.3 10.7 24 24 24h124c6.6 0 12-5.4 12-12z"></path></svg>`,
			"restore": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path fill="currentColor" d="M436 192H312c-13.3 0-24-10.7-24-24V44c0-6.6 5.4-12 12-12h40c6.6 0 12 5.4 12 12v84h84c6.6 0 12 5.4 12 12v40c0 6.6-5.4 12-12 12zm-276-24V44c0-6.6-5.4-12-12-12h-40c-6.6 0-12 5.4-12 12v84H12c-6.6 0-12 5.4-12 12v40c0 6.6 5.4 12 12 12h124c13.3 0 24-10.7 24-24zm0 300V344c0-13.3-10.7-24-24-24H12c-6.6 0-12 5.4-12 12v40c0 6.6 5.4 12 12 12h84v84c0 6.6 5.4 12 12 12h40c6.6 0 12-5.4 12-12zm192 0v-84h84c6.6 0 12-5.4 12-12v-40c0-6.6-5.4-12-12-12H312c-13.3 0-24 10.7-24 24v124c0 6.6 5.4 12 12 12h40c6.6 0 12-5.4 12-12z"></path></svg>`,
			"pin": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M306.5 186.6l-5.7-42.6H328c13.2 0 24-10.8 24-24V24c0-13.2-10.8-24-24-24H56C42.8 0 32 10.8 32 24v96c0 13.2 10.8 24 24 24h27.2l-5.7 42.6C29.6 219.4 0 270.7 0 328c0 13.2 10.8 24 24 24h144v104c0 .9.1 1.7.4 2.5l16 48c2.4 7.3 12.8 7.3 15.2 0l16-48c.3-.8.4-1.7.4-2.5V352h144c13.2 0 24-10.8 24-24 0-57.3-29.6-108.6-77.5-141.4zM50.5 304c8.3-38.5 35.6-70 71.5-87.8L138 96H80V48h224v48h-58l16 120.2c35.8 17.8 63.2 49.4 71.5 87.8z"/></svg>`,
			"unpin": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512"><path d="M298.028 214.267L285.793 96H328c13.255 0 24-10.745 24-24V24c0-13.255-10.745-24-24-24H56C42.745 0 32 10.745 32 24v48c0 13.255 10.745 24 24 24h42.207L85.972 214.267C37.465 236.82 0 277.261 0 328c0 13.255 10.745 24 24 24h136v104.007c0 1.242.289 2.467.845 3.578l24 48c2.941 5.882 11.364 5.893 14.311 0l24-48a8.008 8.008 0 0 0 .845-3.578V352h136c13.255 0 24-10.745 24-24-.001-51.183-37.983-91.42-85.973-113.733z"/></svg>`,
			"options": `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 20 20"><g transform="translate(10 10)"><path id="a" d="M1.5-10h-3l-1 6.5h5m0 7h-5l1 6.5h3"/><use transform="rotate(45)" xlink:href="#a"/><use transform="rotate(90)" xlink:href="#a"/><use transform="rotate(135)" xlink:href="#a"/></g><path d="M10 2.5a7.5 7.5 0 000 15 7.5 7.5 0 000-15v4a3.5 3.5 0 010 7 3.5 3.5 0 010-7"/></svg>`,
			"zoom-left": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M 0,180 V 56 C 0,42.7 10.7,32 24,32 h 124 c 6.6,0 12,5.4 12,12 v 40 c 0,6.6 -5.4,12 -12,12 H 64 v 84 c 0,6.6 -5.4,12 -12,12 H 12 C 5.4,192 0,186.6 0,180 Z m 160,288 v -40 c 0,-6.6 -5.4,-12 -12,-12 H 64 v -84 c 0,-6.6 -5.4,-12 -12,-12 H 12 c -6.6,0 -12,5.4 -12,12 v 124 c 0,13.3 10.7,24 24,24 h 124 c 6.6,0 12,-5.4 12,-12 z" /></svg>`,
			"zoom-right": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="m 288,44 v 40 c 0,6.6 5.4,12 12,12 h 84 v 84 c 0,6.6 5.4,12 12,12 h 40 c 6.6,0 12,-5.4 12,-12 V 56 C 448,42.7 437.3,32 424,32 H 300 c -6.6,0 -12,5.4 -12,12 z m 148,276 h -40 c -6.6,0 -12,5.4 -12,12 v 84 h -84 c -6.6,0 -12,5.4 -12,12 v 40 c 0,6.6 5.4,12 12,12 h 124 c 13.3,0 24,-10.7 24,-24 V 332 c 0,-6.6 -5.4,-12 -12,-12 z" /></svg>`,
			"zoom-top": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M 0,180 V 56 C 0,42.7 10.7,32 24,32 h 124 c 6.6,0 12,5.4 12,12 v 40 c 0,6.6 -5.4,12 -12,12 H 64 v 84 c 0,6.6 -5.4,12 -12,12 H 12 C 5.4,192 0,186.6 0,180 Z M 288,44 v 40 c 0,6.6 5.4,12 12,12 h 84 v 84 c 0,6.6 5.4,12 12,12 h 40 c 6.6,0 12,-5.4 12,-12 V 56 C 448,42.7 437.3,32 424,32 H 300 c -6.6,0 -12,5.4 -12,12 z" /></svg>`,
			"zoom-bottom": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="m 436,320 h -40 c -6.6,0 -12,5.4 -12,12 v 84 h -84 c -6.6,0 -12,5.4 -12,12 v 40 c 0,6.6 5.4,12 12,12 h 124 c 13.3,0 24,-10.7 24,-24 V 332 c 0,-6.6 -5.4,-12 -12,-12 z M 160,468 v -40 c 0,-6.6 -5.4,-12 -12,-12 H 64 v -84 c 0,-6.6 -5.4,-12 -12,-12 H 12 c -6.6,0 -12,5.4 -12,12 v 124 c 0,13.3 10.7,24 24,24 h 124 c 6.6,0 12,-5.4 12,-12 z" /></svg>`,
			"zoom-top-left": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="M 0,180 V 56 C 0,42.7 10.7,32 24,32 h 124 c 6.6,0 12,5.4 12,12 v 40 c 0,6.6 -5.4,12 -12,12 H 64 v 84 c 0,6.6 -5.4,12 -12,12 H 12 C 5.4,192 0,186.6 0,180 Z" /></svg>`,
			"zoom-top-right": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="m 288,44 v 40 c 0,6.6 5.4,12 12,12 h 84 v 84 c 0,6.6 5.4,12 12,12 h 40 c 6.6,0 12,-5.4 12,-12 V 56 C 448,42.7 437.3,32 424,32 H 300 c -6.6,0 -12,5.4 -12,12 z" /></svg>`,
			"zoom-bottom-left": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="m 160,468 v -40 c 0,-6.6 -5.4,-12 -12,-12 H 64 v -84 c 0,-6.6 -5.4,-12 -12,-12 H 12 c -6.6,0 -12,5.4 -12,12 v 124 c 0,13.3 10.7,24 24,24 h 124 c 6.6,0 12,-5.4 12,-12 z" /></svg>`,
			"zoom-bottom-right": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512"><path d="m 436,320 h -40 c -6.6,0 -12,5.4 -12,12 v 84 h -84 c -6.6,0 -12,5.4 -12,12 v 40 c 0,6.6 5.4,12 12,12 h 124 c 13.3,0 24,-10.7 24,-24 V 332 c 0,-6.6 -5.4,-12 -12,-12 z" /></svg>`
		},
		buttonTitles: {
			"close": "Close this popup",
			"maximize": "Maximize this popup",
			"restore": "Restore this popup to normal size",
			"pin": "Pin this popup to the screen",
			"unpin": "Un-pin this popup from the screen",
			"options": "Show options",
			"zoom-left": "Place this popup on the left half of the screen",
			"zoom-right": "Place this popup on the right half of the screen",
			"zoom-top": "Place this popup on the top half of the screen",
			"zoom-bottom": "Place this popup on the bottom half of the screen",
			"zoom-top-left": "Place this popup in the top-left quarter of the screen",
			"zoom-top-right": "Place this popup in the top-right quarter of the screen",
			"zoom-bottom-left": "Place this popup in the bottom-left quarter of the screen",
			"zoom-bottom-right": "Place this popup in the bottom-right quarter of the screen"
		},
		genericButton: () => {
			let button = document.createElement("BUTTON");
			button.classList.add("popframe-title-bar-button");
			button.buttonAction = (event) => {
				event.stopPropagation();
			};
			return button;
		},
		closeButton: () => {
			let button = Popups.titleBarComponents.genericButton();
			button.innerHTML = Popups.titleBarComponents.buttonIcons["close"];
			button.title = Popups.titleBarComponents.buttonTitles["close"];
			button.classList.add("close-button");
			button.buttonAction = (event) => {
				event.stopPropagation();

				let popup = event.target.closest(".popup");
				if (popup) {
					Popups.unpinPopup(popup);
					Popups.getPopupAncestorStack(popup).reverse().forEach(popupInStack => {
						Popups.clearPopupTimers(popupInStack.spawningTarget);
						Popups.despawnPopup(popupInStack);
					});
				}
			};
			return button;
		},
		maximizeButton: () => {
			let button = Popups.titleBarComponents.genericButton();
			button.defaultHTML = Popups.titleBarComponents.buttonIcons["maximize"];
			button.alternateHTML = Popups.titleBarComponents.buttonIcons["restore"];
			button.defaultTitle = Popups.titleBarComponents.buttonTitles["maximize"];
			button.alternateTitle = Popups.titleBarComponents.buttonTitles["restore"];
			button.innerHTML = button.defaultHTML;
			button.title = button.defaultTitle;
			button.classList.add("maximize-button", "maximize");
			button.buttonAction = (event) => {
				event.stopPropagation();

				let popup = button.closest(".popup");
				if (popup) {
					Popups.zoomPopup(popup);
					popup.titleBar.querySelectorAll("button.maximize-button, button.pin-button").forEach(titleBarButton => {
						titleBarButton.updateState();
					});
				}
			};
			button.updateState = () => {
				let popup = button.closest(".popup");
				if (!popup)
					return;

				button.innerHTML = Popups.popupIsMaximized(popup) ? button.alternateHTML : button.defaultHTML;
				button.title = Popups.popupIsMaximized(popup) ? button.alternateTitle : button.defaultTitle;

				button.swapClasses([ "maximize", "restore" ], (Popups.popupIsMaximized(popup) ? 1 : 0));
			};
			return button;
		},
		pinButton: () => {
			let button = Popups.titleBarComponents.genericButton();
			button.defaultHTML = Popups.titleBarComponents.buttonIcons["pin"];
			button.alternateHTML = Popups.titleBarComponents.buttonIcons["unpin"];
			button.defaultTitle = Popups.titleBarComponents.buttonTitles["pin"];
			button.alternateTitle = Popups.titleBarComponents.buttonTitles["unpin"];
			button.innerHTML = button.defaultHTML;
			button.title = button.defaultTitle;
			button.classList.add("pin-button", "pin");
			button.buttonAction = (event) => {
				event.stopPropagation();

				let popup = button.closest(".popup");
				if (popup) {
					if (Popups.popupIsPinned(popup)) {
						Popups.unpinPopup(popup);
					} else {
						Popups.pinPopup(popup);
					}
					button.updateState();
				}
			};
			button.updateState = () => {
				let popup = button.closest(".popup");
				if (!popup)
					return;

				button.innerHTML = Popups.popupIsPinned(popup) ? button.alternateHTML : button.defaultHTML;
				button.title = Popups.popupIsPinned(popup) ? button.alternateTitle : button.defaultTitle;

				button.swapClasses([ "pin", "unpin" ], (Popups.popupIsPinned(popup) ? 1 : 0));

				button.disabled = Popups.popupIsMaximized(popup);
			};
			return button;
		},
		optionsButton: () => {
			let button = Popups.titleBarComponents.genericButton();
			button.innerHTML = Popups.titleBarComponents.buttonIcons["options"];
			button.title = Popups.titleBarComponents.buttonTitles["options"];
			return button;
		}
	},

	popupIsMaximized: (popup) => {
		return popup.classList.contains("maximized");
	},

	popupWasRestored: (popup) => {
		return popup.classList.contains("restored");
	},

	popupIsPinned: (popup) => {
		return popup.classList.contains("pinned") || Popups.popupIsMaximized(popup);
	},

	popupWasUnpinned: (popup) => {
		return popup.classList.contains("unpinned");
	},

	zoomPopup: (popup) => {
		let maximize = !Popups.popupIsMaximized(popup);
		popup.swapClasses([ "maximized", "restored" ], (maximize ? 0 : 1));
		if (maximize) {
			let popupRect = popup.getBoundingClientRect();
			popup.dataset.previousXPosition = popupRect.left;
			popup.dataset.previousYPosition = popupRect.top;
		}
		Popups.positionPopup(popup);

		if (maximize) {
			popup.popupStack.remove(popup);
		} else if (!Popups.popupIsPinned(popup)) {
			popup.popupStack.push(popup);
		}

		Popups.updatePageScrollState();
	},

	pinPopup: (popup) => {
		popup.swapClasses([ "pinned", "unpinned" ], 0);
		Popups.positionPopup(popup);
		popup.popupStack.remove(popup);
		Popups.detachPopupFromTarget(popup);
	},

	unpinPopup: (popup) => {
		popup.swapClasses([ "pinned", "unpinned" ], 1);
		Popups.positionPopup(popup);
		popup.popupStack.push(popup);
        popup.spawningTarget.popup = popup;
        popup.spawningTarget.popFrame = popup;
	},

	placePopup: (popup, place) => {
		//  Viewport width must account for vertical scroll bar.
		let viewportWidth = document.documentElement.offsetWidth;
		let viewportHeight = window.innerHeight;

		let posX, posY;
		switch (place) {
			case "left":
				posX = 0.0;
				posY = 0.0;
				break;
			case "right":
				posX = viewportWidth / 2.0;
				posY = 0.0;
				break;
			case "top":
				posX = 0.0;
				posY = 0.0;
				break;
			case "bottom":
				posX = 0.0;
				posY = viewportHeight / 2.0;
				break;
			case "top-left":
				posX = 0.0;
				posY = 0.0;
				break;
			case "top-right":
				posX = viewportWidth / 2.0;
				posY = 0.0;
				break;
			case "bottom-left":
				posX = 0.0;
				posY = viewportHeight / 2.0;
				break;
			case "bottom-right":
				posX = viewportWidth / 2.0;
				posY = viewportHeight / 2.0;
				break;
		}

		Popups.setPopupPositionInViewport(popup, { x: posX, y: posY });

		popup.style.maxWidth = "unset";
		popup.style.maxHeight = "unset";
		switch (place) {
			case "left":
			case "right":
				popup.style.width = "50%";
				popup.style.height = "100vh";
				break;
			case "top":
			case "bottom":
				popup.style.width = "100%";
				popup.style.height = "50vh";
				break;
			case "top-left":
			case "top-right":
			case "bottom-left":
			case "bottom-right":
				popup.style.width = "50%";
				popup.style.height = "50vh";
				break;
		}
	},

	updatePageScrollState: () => {
		if (Popups.allSpawnedPopups().findIndex(popup => Popups.popupIsMaximized(popup)) == -1)
			togglePageScrolling(true);
		else
			togglePageScrolling(false);
	},

	hidePopupContainer: () => {
		Popups.popupContainer.style.visibility = "hidden";
	},

	unhidePopupContainer: () => {
		Popups.popupContainer.style.visibility = "";
	},

	newPopup: () => {
		GWLog("Popups.newPopup", "popups.js", 2);

		let popup = document.createElement("div");
		popup.classList.add("popup", "popframe");
		popup.innerHTML = `<div class="popframe-scroll-view"><div class="popframe-content-view"></div></div>`;
		popup.scrollView = popup.querySelector(".popframe-scroll-view");
		popup.contentView = popup.querySelector(".popframe-content-view");
		popup.titleBarContents = [ ];
		return popup;
	},
	setPopFrameContent: (popup, contentHTML) => {
		popup.querySelector(".popframe-content-view").innerHTML = contentHTML;
		return (contentHTML > "");
	},
	spawnPopup: (target, spawnPoint) => {
		GWLog("Popups.spawnPopup", "popups.js", 2);

		//  Prevent spawn attempts before setup complete.
		if (Popups.popupContainer == null)
			return;

		//  Despawn existing popup, if any.
		if (target.popup)
			Popups.despawnPopup(target.popup);

		//  Create the new popup.
		target.popup = Popups.newPopup();
		target.popFrame = target.popup;

		//  Give the popup a reference to the target.
		target.popup.spawningTarget = target;

		// Prepare the newly created popup for spawning.
		if (!(target.popup = target.preparePopup(target.popup)))
			return;

		/*  If title bar contents are provided, create and inject the popup
			title bar, and set class `has-title-bar` on the popup.
			*/
		if (target.popup.titleBarContents.length > 0) {
			target.popup.classList.add("has-title-bar");

			target.popup.titleBar = document.createElement("div");
			target.popup.titleBar.classList.add("popframe-title-bar");
			target.popup.titleBar.title = "Drag popup by title bar to reposition";
			target.popup.insertBefore(target.popup.titleBar, target.popup.firstElementChild);

			target.popup.titleBarContents.forEach(elementOrHTML => {
				if (typeof elementOrHTML == "string") {
					target.popup.titleBar.insertAdjacentHTML("beforeend", elementOrHTML);
				} else {
					target.popup.titleBar.appendChild(elementOrHTML);
				}
				let newlyAddedElement = target.popup.titleBar.lastElementChild;
				if (newlyAddedElement.buttonAction)
					newlyAddedElement.addActivateEvent(newlyAddedElement.buttonAction);

				//  Add popup-positioning submenu to maximize button.
				if (   newlyAddedElement.classList.contains("maximize-button") 
					&& newlyAddedElement.submenuEnabled) {
					let maximizeButton = newlyAddedElement;

					maximizeButton.classList.add("has-submenu");

					maximizeButton.submenu = document.createElement("div");
					maximizeButton.submenu.classList.add("submenu", "window-arrange-menu");
					target.popup.titleBar.appendChild(maximizeButton.submenu);
					Popups.titleBarComponents.popupPlaces.forEach(position => {
						let button = Popups.titleBarComponents.genericButton();
						button.innerHTML = Popups.titleBarComponents.buttonIcons[`zoom-${position}`];
						button.title = Popups.titleBarComponents.buttonTitles[`zoom-${position}`];
						button.classList.add("zoom-button", position);
						button.buttonAction = (event) => {
							event.stopPropagation();

							let popup = button.closest(".popup");
							if (popup)
								Popups.placePopup(popup, position);
						};
						maximizeButton.submenu.appendChild(button);
						button.addActivateEvent(button.buttonAction);
					});
				}
			});

			target.popup.titleBar.addActivateEvent((event) => {
				event.stopPropagation();
			});

			target.popup.titleBar.addEventListener("mousedown", Popups.popupTitleBarMouseDown = (event) => {
				GWLog("Popups.popupTitleBarMouseDown", "popups.js", 2);

				//  We only want to do anything on left-clicks.
				if (event.button != 0)
					return;

				//  Also do nothing if the click is on a title bar button.
				if (event.target.closest(".popframe-title-bar-button"))
					return;

				event.preventDefault();

				let popup = event.target.closest(".popup");
				popup.classList.toggle("grabbed", true);

				//  Change cursor to “grabbing hand”.
				document.documentElement.style.cursor = "grabbing";

				/*  If the mouse-down event is on the popup title (and the title
					is a link).
					*/
				let linkDragTarget = event.target.closest("a");

				/*  Deal with edge case where drag to screen bottom ends up
					with the mouse-up event happening in the popup body.
					*/
				popup.removeEventListener("click", Popups.popupClicked);

				//  Point where the drag began.
				let dragStartMouseCoordX = event.clientX;
				let dragStartMouseCoordY = event.clientY;

				let popupRect = popup.getBoundingClientRect();
				let popupPosition = {
					x: popupRect.left,
					y: popupRect.top
				};

				window.addEventListener("mouseup", Popups.popupDragMouseUp = (event) => {
					GWLog("Popups.popupDragMouseUp", "popups.js", 2);

					event.stopPropagation();

					window.onmousemove = null;

					//  Reset cursor to normal.
					document.documentElement.style.cursor = "";

					let popup = window.popupBeingDragged;
					if (popup) {
						popup.classList.toggle("grabbed", false);
						popup.classList.toggle("dragging", false);

						if (linkDragTarget) {
							requestAnimationFrame(() => {
								linkDragTarget.onclick = null;
								linkDragTarget = null;
							});
						}

						//  Ensure that the click listener isn’t fired at once.
						requestAnimationFrame(() => {
							popup.addEventListener("click", Popups.popupClicked);
						});

						/*  If the drag of a non-pinned popup ended outside the
							popup (possibly outside the viewport), treat this
							as mousing out of the popup.
							*/
						if ((  !event.target.closest 
							 || event.target.closest(".popup") == null)
							&& !Popups.popupIsPinned(popup)) {
							Popups.getPopupAncestorStack(popup).reverse().forEach(popupInStack => {
								Popups.clearPopupTimers(popupInStack.spawningTarget);
								Popups.setPopupFadeTimer(popupInStack.spawningTarget);
							});
						}
					}
					window.popupBeingDragged = null;

					window.removeEventListener("mouseup", Popups.popupDragMouseUp);
				});

				//  Viewport width must account for vertical scroll bar.
				let viewportWidth = document.documentElement.offsetWidth;
				let viewportHeight = window.innerHeight;

				window.onmousemove = (event) => {
					window.popupBeingDragged = popup;

					popup.classList.toggle("dragging", true);
					if (linkDragTarget)
						linkDragTarget.onclick = (event) => { return false; };

					popupPosition.x = popupRect.left + (event.clientX - dragStartMouseCoordX);
					popupPosition.y = popupRect.top + (event.clientY - dragStartMouseCoordY);

					//  Restrict popup position to viewport limits.
					popupPosition.x = Math.max(Math.min(popupPosition.x, viewportWidth - popupRect.width), 0)
					popupPosition.y = Math.max(Math.min(popupPosition.y, viewportHeight - popupRect.height), 0);

					Popups.setPopupPositionInViewport(popup, popupPosition);
				};
			});
			target.popup.titleBar.addEventListener("mouseup", (event) => {
				let popup = event.target.closest(".popup");
				popup.classList.toggle("grabbed", false);
			});
		}

		//	Inject the popup into the page.
		Popups.injectPopup(target.popup);

		//  Position the popup appropriately with respect to the target.
		Popups.positionPopup(target.popup, spawnPoint);

		//  Mark target as having an active popup associated with it.
		target.classList.add("popup-open");

		GW.notificationCenter.fireEvent("Popups.popupDidSpawn", { popup: target.popup });
	},
	injectPopup: (popup) => {
		GWLog("Popups.injectPopup", "popups.js", 2);

		//  Add popup to a popup stack.
		if (popup.popupStack == null) {
			let parentPopup = popup.spawningTarget.closest(".popup");
			popup.popupStack = parentPopup ? parentPopup.popupStack : [ ];
		} else {
			popup.popupStack.remove(popup);
		}
		popup.popupStack.push(popup);

		//  Inject popup into page.
		Popups.popupContainer.appendChild(popup);

		//	Add event listeners.
		popup.addEventListener("click", Popups.popupClicked);
		popup.addEventListener("mouseenter", Popups.popupMouseenter);
		popup.addEventListener("mouseleave", Popups.popupMouseleave);
	},
	positionPopup: (popup, spawnPoint) => {
		let target = popup.spawningTarget;
		if (spawnPoint) target.lastMouseEnterLocation = spawnPoint;
		else spawnPoint = target.lastMouseEnterLocation;

		let targetViewportRect = target.getBoundingClientRect();

		//	Prevent popup cycling in Chromium.
		popup.style.visibility = "hidden";

		//  Wait for the “naive” layout to be completed, and then...
		requestAnimationFrame(() => {
			/*  How much "breathing room" to give the target (i.e., offset of
				the popup).
				*/
			let popupBreathingRoom = {
				x: Popups.popupBreathingRoomX,
				y: Popups.popupBreathingRoomY
			};

			/*  This is the width and height of the popup, as already determined
				by the layout system, and taking into account the popup's content,
				and the max-width, min-width, etc., CSS properties.
				*/
			let popupIntrinsicWidth = popup.offsetWidth;
			let popupIntrinsicHeight = popup.offsetHeight;

			let provisionalPopupXPosition = 0.0;
			let provisionalPopupYPosition = 0.0;

			let offToTheSide = false;
			let popupSpawnYOriginForSpawnAbove = targetViewportRect.top - popupBreathingRoom.y;
			let popupSpawnYOriginForSpawnBelow = targetViewportRect.bottom + popupBreathingRoom.y;
			if (target.closest(".popup") || Popups.preferSidePositioning(target)) {
				/*  The popup is a nested popup, or the target specifies that it
					prefers to have popups spawned to the side; we try to put
					the popup off to the left or right.
					*/
				offToTheSide = true;
			}

			provisionalPopupYPosition = spawnPoint.y - ((spawnPoint.y / window.innerHeight) * popupIntrinsicHeight);
			if (provisionalPopupYPosition < 0.0)
				provisionalPopupYPosition = 0.0;

			//  Determine whether to put the popup off to the right, or left.
			if (  targetViewportRect.right
				+ popupBreathingRoom.x
				+ popupIntrinsicWidth
				  <= document.documentElement.offsetWidth) {
				//  Off to the right.
				provisionalPopupXPosition = targetViewportRect.right + popupBreathingRoom.x;
			} else if (  targetViewportRect.left
					   - popupBreathingRoom.x
					   - popupIntrinsicWidth
						 >= 0) {
				//  Off to the left.
				provisionalPopupXPosition = targetViewportRect.left - popupIntrinsicWidth - popupBreathingRoom.x;
			} else {
				//  Not off to either side, in fact.
				offToTheSide = false;
			}

			/*  Can the popup fit above the target? If so, put it there.
				Failing that, can it fit below the target? If so, put it there.
				*/
			if (!offToTheSide) {
				if (  popupSpawnYOriginForSpawnAbove
					- popupIntrinsicHeight
					  >= 0) {
					//  Above.
					provisionalPopupYPosition = popupSpawnYOriginForSpawnAbove - popupIntrinsicHeight;
				} else if (  popupSpawnYOriginForSpawnBelow 
						   + popupIntrinsicHeight 
						     <= window.innerHeight) {
					//  Below.
					provisionalPopupYPosition = popupSpawnYOriginForSpawnBelow;
				} else {
					/*  The popup does not fit above or below! We will have to
						put it off to to the right after all...
						*/
					offToTheSide = true;
				}
			}

			if (!offToTheSide) {
				/*  Place popup off to the right (and either above or below),
					as per the previous block of code.
					*/
				provisionalPopupXPosition = spawnPoint.x + popupBreathingRoom.x;
			}

			/*  Does the popup extend past the right edge of the container?
				If so, move it left, until its right edge is flush with
				the container’s right edge.
				*/
			if (  provisionalPopupXPosition 
				+ popupIntrinsicWidth 
				  > document.documentElement.offsetWidth) {
				//  We add 1.0 here to prevent wrapping due to rounding.
				provisionalPopupXPosition -= (provisionalPopupXPosition + popupIntrinsicWidth - document.documentElement.offsetWidth + 1.0);
			}

			/*  Now (after having nudged the popup left, if need be),
				does the popup extend past the *left* edge of the container?
				Make its left edge flush with the container's left edge.
				*/
			if (provisionalPopupXPosition < 0) {
				provisionalPopupXPosition = 0;
			}

			//  Special cases for maximizing/restoring and pinning/unpinning.
			if (Popups.popupIsPinned(popup)) {
				if (Popups.popupIsMaximized(popup)) {
					provisionalPopupXPosition = 0.0;
					provisionalPopupYPosition = 0.0;
				} else {
					if (Popups.popupWasRestored(popup)) {
						provisionalPopupXPosition = parseFloat(popup.dataset.previousXPosition);
						provisionalPopupYPosition = parseFloat(popup.dataset.previousYPosition);

						popup.classList.toggle("restored", false);
					} else {
						let popupRect = popup.getBoundingClientRect();
						provisionalPopupXPosition = popupRect.left;
						provisionalPopupYPosition = popupRect.top;
					}
				}
			} else {
				if (Popups.popupWasUnpinned(popup)) {
					let popupRect = popup.getBoundingClientRect();
					provisionalPopupXPosition = popupRect.left;
					provisionalPopupYPosition = popupRect.top;

					popup.classList.toggle("unpinned", false);
				} else if (Popups.popupWasRestored(popup)) {
					provisionalPopupXPosition = parseFloat(popup.dataset.previousXPosition);
					provisionalPopupYPosition = parseFloat(popup.dataset.previousYPosition);

					popup.classList.toggle("restored", false);
				}
			}

			Popups.setPopupPositionInViewport(popup, { x: provisionalPopupXPosition, y: provisionalPopupYPosition});

			//	Prevent popup cycling in Chromium.
			popup.style.visibility = "";

			document.activeElement.blur();
		});
	},
	setPopupPositionInViewport: (popup, position) => {
		popup.classList.remove(...(Popups.titleBarComponents.popupPlaces.map(place => `place-${place}`)));
		popup.style.maxWidth = "";
		popup.style.maxHeight = "";
		popup.style.width = "";
		popup.style.height = "";

		if (!Popups.popupIsPinned(popup)) {
			let popupContainerViewportRect = Popups.popupContainer.getBoundingClientRect();
			position.x -= popupContainerViewportRect.left;
			position.y -= popupContainerViewportRect.top;
		}

		popup.style.position = Popups.popupIsPinned(popup) ? "fixed" : "";

		popup.style.left = `${position.x}px`;
		popup.style.top = `${position.y}px`;
	},
	detachPopupFromTarget: (popup) => {
		GWLog("Popups.detachPopupFromTarget", "popups.js", 2);

		Popups.clearPopupTimers(popup.spawningTarget);

        popup.spawningTarget.classList.remove("popup-open");
        popup.spawningTarget.popup = null;
        popup.spawningTarget.popFrame = null;
	},
    despawnPopup: (popup) => {
		GWLog("Popups.despawnPopup", "popups.js", 2);

		GW.notificationCenter.fireEvent("Popups.popupWillDespawn", { popup: popup });

        Popups.detachPopupFromTarget(popup);
        popup.remove();
        popup.popupStack.remove(popup);
        popup.popupStack = null;

		Popups.updatePageScrollState();

        document.activeElement.blur();
    },

    clearPopupTimers: (target) => {
	    GWLog("Popups.clearPopupTimers", "popups.js", 3);

		if (target.popup)
			target.popup.classList.remove("fading");

        clearTimeout(target.popupFadeTimer);
        clearTimeout(target.popupDespawnTimer);
        clearTimeout(target.popupSpawnTimer);
    },
	setPopupSpawnTimer: (target, event) => {
		GWLog("Popups.setPopupSpawnTimer", "popups.js", 2);

		target.popupSpawnTimer = setTimeout(() => {
			GWLog("Popups.popupSpawnTimer fired", "popups.js", 2);

			// Spawn the popup.
			Popups.spawnPopup(target, { x: event.clientX, y: event.clientY });
		}, Popups.popupTriggerDelay);
	},
    setPopupFadeTimer: (target) => {
		GWLog("Popups.setPopupFadeTimer", "popups.js", 2);

        target.popupFadeTimer = setTimeout(() => {
			GWLog("popupFadeTimer fired", "popups.js", 2);

			Popups.setPopupDespawnTimer(target);
        }, Popups.popupFadeoutDelay);
    },
    setPopupDespawnTimer: (target) => {
		GWLog("Popups.setPopupDespawnTimer", "popups.js", 2);

		target.popup.classList.add("fading");
		target.popupDespawnTimer = setTimeout(() => {
			GWLog("popupDespawnTimer fired", "popups.js", 2);

			Popups.despawnPopup(target.popup);
		}, Popups.popupFadeoutDuration);
    },

	getPopupAncestorStack: (popup) => {
		let indexOfPopup = popup.popupStack.indexOf(popup);
		if (indexOfPopup != -1) {
			return popup.popupStack.slice(0, indexOfPopup + 1);
		} else {
			let parentPopup = popup.spawningTarget.closest(".popup");
			return (parentPopup && parentPopup.popupStack) ? Popups.getPopupAncestorStack(parentPopup) : [ ];
		}
	},

    //	The “user moved mouse out of popup” mouseleave event.
	popupMouseleave: (event) => {
		GWLog("Popups.popupMouseleave", "popups.js", 2);

		if (window.popupBeingDragged)
			return;

		Popups.getPopupAncestorStack(event.target).reverse().forEach(popupInStack => {
			Popups.clearPopupTimers(popupInStack.spawningTarget);
			Popups.setPopupFadeTimer(popupInStack.spawningTarget);
		});
	},
	//	The “user moved mouse back into popup” mouseenter event.
	popupMouseenter: (event) => {
		GWLog("Popups.popupMouseenter", "popups.js", 2);

		Popups.getPopupAncestorStack(event.target).forEach(popupInStack => {
			Popups.clearPopupTimers(popupInStack.spawningTarget);
		});
	},
    popupClicked: (event) => {
		GWLog("Popups.popupClicked", "popups.js", 2);

		let popup = event.target.closest(".popup");

		if (Popups.popupIsPinned(popup))
			return;

		event.stopPropagation();
		Popups.clearPopupTimers(popup.spawningTarget);
		Popups.despawnPopup(popup);
    },
	//	The mouseenter event.
	targetMouseenter: (event) => {
		GWLog("Popups.targetMouseenter", "popups.js", 2);

		if (window.popupBeingDragged)
			return;

		//	Stop the countdown to un-pop the popup.
		Popups.clearPopupTimers(event.target);

		if (event.target.popup == null) {
			//  Start the countdown to pop up the popup (if not already spawned).
			Popups.setPopupSpawnTimer(event.target, event);
		} else {
			/*  If already spawned, just bring the popup to the front and
				re-position it.
				*/

			//  Save popup’s scroll position.
			let scrollTop = event.target.popup.scrollView.scrollTop;

			//  Re-inject popup into page, bringing it to the front.
			Popups.injectPopup(event.target.popup);

			//  Restore popup’s scroll position.
			event.target.popup.scrollView.scrollTop = scrollTop;

			//  Re-position popup.
			Popups.positionPopup(event.target.popup, { x: event.clientX, y: event.clientY });
		}
	},
	//	The mouseleave event.
	targetMouseleave: (event) => {
		GWLog("Popups.targetMouseleave", "popups.js", 2);

		event.target.lastMouseEnterEvent = null;

		Popups.clearPopupTimers(event.target);

		if (event.target.popup)
			Popups.setPopupFadeTimer(event.target);
	}
};

GW.notificationCenter.fireEvent("Popups.didLoad");

/******************/
/*	Initialization.
	*/
doWhenPageLoaded(() => {
	Popups.setup();
});
