// popups.js: standalone Javascript library for creating 'popups' which display link metadata (typically, title/author/date/summary), for extremely convenient reference/abstract reading.
// Author: Said Achmiz, Shawn Presser (mobile & Youtube support)
// Date: 2019-09-12
// When:
// license: MIT (derivative of footnotes.js, which is PD)

// popups.js parses a HTML document and looks for <a> links which have the 'docMetadata' attribute class, and the attributes 'data-popup-title', 'data-popup-author', 'data-popup-date', 'data-popup-doi', 'data-popup-abstract'.
// (These attributes are expected to be populated already by the HTML document's compiler, however, they can also be done dynamically. See 'https://share.obormot.net/misc/gwern/wikipedia-popups.js' for an example of a library which does Wikipedia-only dynamically on page loads.)

// Popups are inspired by Wikipedia's augmented tooltips (originally implemented as editor-built extensions, now available to all readers via https://www.mediawiki.org/wiki/Page_Previews ). Whenever any such link is mouse-overed by the user, popups.js will pop up a large tooltip-like square with the contents of the attributes. This is particularly intended for references, where it is extremely convenient to autopopulate links such as to Arxiv.org/Biorxiv.org/Wikipedia with the link's title/author/date/abstract, so the reader can see it instantly. Links to 'reverse citations' are provided as much as possible: links with DOIs go to a Semantic Scholar search engine query for that DOI, which prioritizes meta-analyses & systematic reviews to provide context for any given paper (particularly whether it has failed to replicate or otherwise been debunked); for URLs ending in 'PDF' which probably have Semantic Scholar entries, they go to a title search; and for all other URLs, a Google search using the obscure `link:` operator is provided.. For more details, see `LinkMetadata.hs`.

// On mobile, clicking on links (as opposed to hovering over links on desktop) will bring up the annotation or video; another click on it or the popup will then go to it. A click outside it de-activates it.

// For an example of a Hakyll library which generates annotations for Wikipedia/Biorxiv/Arxiv/PDFs/arbitrarily-defined links, see https://www.gwern.net/LinkMetadata.hs ; for a live demonstration, see the links in https://www.gwern.net/newsletter/2019/07

Extracts = {
    imageFileExtensions: [ "bmp", "gif", "ico", "jpeg", "jpg", "png", "svg" ],
    codeFileExtensions: [ "R", "css", "hs", "js", "patch", "sh", "php", "conf" ],
};

Extracts = {
	/**********/
	/*	Config.
		*/
	contentContainersSelector: "#markdownBody, #TOC",
    // WARNING: selectors must not contain periods; Pandoc will generate section headers which contain periods in them, which will break the query selector; see https://github.com/jgm/pandoc/issues/6553
    imageFileExtensions: Extracts.imageFileExtensions,
    codeFileExtensions: Extracts.codeFileExtensions,
    targets: {
		targetElementsSelector: [
			"a.docMetadata, a[href*='youtube.com'], a[href*='youtu.be'], #TOC a, a[href^='#'], a[href^='/'][href*='#'], a[href^='/docs/www/'], a.footnote-back, span.defnMetadata", 
			Extracts.imageFileExtensions.map(ext => `a[href^='/'][href$='${ext}'], a[href^='https://www.gwern.net/'][href$='${ext}']`).join(", "),
			Extracts.codeFileExtensions.map(ext => `a[href^='/'][href$='${ext}'], a[href^='https://www.gwern.net/'][href$='${ext}']`).join(", ")
			].join(", "),
		excludedElementsSelector: ".external-section-embed-popup .footnote-ref",
		excludedContainerElementsSelector: "h1, h2, h3, h4, h5, h6"
    },

	/***********/
	/*	Content.
		*/
    extractForTarget: (target) => {
		GWLog("Extracts.extractForTarget", "extracts.js", 2);

		//  Title and abstract are mandatory.
		if (!target.dataset.popupTitleHtml || !target.dataset.popupAbstract)
			return null;

		//  Link to original URL (for archive links) or link to archive (for live links).
        var archiveOrOriginalLink = "";
        if (   target.dataset.urlOriginal != undefined 
        	&& target.dataset.urlOriginal != target.href) {
            archiveOrOriginalLink = (`<span class="originalURL"><code>` + "[" + 
            		   `<a href="${target.dataset.urlOriginal}" target="_new" 
                       		title="Link to original URL for ‘${target.dataset.popupTitle}’" 
                       		alt="Original URL for this archived link; may be broken.">` + 
                       "URL" + `</a>` + "]" + `</code></span>`);
        } else if (!target.href.startsWithAnyOf([ "https://www.gwern.net", "https://en.wikipedia.org", "https://archive.org", "https://www.biorxiv.org", "https://arxiv.org" ])) {
			archiveOrOriginalLink = (`<span class="iaMirror">` +
					   `<a title="Search Internet Archive via Memento for mirrors of URL: <${target.href}> (for ‘${target.dataset.popupTitle}’)" 
					   		href="http://timetravel.mementoweb.org/list/20100101000000/${target.href}" target="_new">` +
					   `</a></span>`);
        }

		//  Extract title/link.
		let titleLink = `<a class="title-link" target="_new" href="${target.href}" title="Open ${target.href} in a new window">${target.dataset.popupTitleHtml}</a>`;

		//	Author.
		let author = `<span class="data-field author">${(target.dataset.popupAuthor || "")}</span>`;

		//  Link to citations on Google Scholar, or link to search for links on Google.
        var citationsOrLinks = "";
        if (target.dataset.popupDoi != undefined) {
            citationsOrLinks = `; <a href="https://scholar.google.com/scholar?q=%22${target.dataset.popupDoi}%22+OR+%22${target.dataset.popupTitle}%22" target="_new" title="Reverse citations of this paper (‘${target.dataset.popupTitle}’), with DOI ‘${target.dataset.popupDoi}’, in Google Scholar">` + "cites" + `</a>`;
        } else if (target.href.includesAnyOf([ "pdf", "https://arxiv.org", "https://openreview.net", "ieee.org", "rand.org", "dspace.mit.edu", "thegradient.pub", "inkandswitch.com", "nature.com", "sciencemag.org" ])) {
            /* Not all scholarly papers come with DOIs; eg it's the policy of Arxiv to *not* provide DOIs. ;_; */
            citationsOrLinks = `; <a href="https://scholar.google.com/scholar?q=%22${target.dataset.popupTitle}%22" target='_new' title="Reverse citations of this paper (‘${target.dataset.popupTitle}’) in Google Scholar">` + "cites" + `</a>`;
        } else if (!target.href.startsWith("https://en.wikipedia.org")) {
            citationsOrLinks = `; <a class="cites" href="https://www.google.com/search?num=100&q=link%3A%22${target.href}%22+OR+%22${target.dataset.popupTitle}%22" target="_new" title="Links to this page (‘${target.dataset.popupTitle}’) in Google">` + "links" + `</a>`;
        }

		//	Date; citations/links.
		let dateAndCitationsOrLinks = (target.dataset.popupDate ? ` <span class="date-plus-cites">(<span class="data-field date">${target.dataset.popupDate}</span>${citationsOrLinks})</span>` : ``);

		//  The fully constructed extract popup contents.
        return `<div>` +
                   `<p class="data-field title">${archiveOrOriginalLink}${titleLink}</p>` +
                   `<p class="data-field author-plus-date">${author}${dateAndCitationsOrLinks}</p>` +
                   `<div class="data-field popupAbstract">${target.dataset.popupAbstract}</div>` +
               `</div>`;
    },
    definitionForTarget: (target) => {
		GWLog("Extracts.definitionForTarget", "extracts.js", 2);

		//  Title and abstract are mandatory.
		if (!target.dataset.popupTitleHtml || !target.dataset.popupAbstract)
			return null;

		let author = `<span class="data-field author">${(target.dataset.popupAuthor || "")}</span>`
		let date = (target.dataset.popupDate ? ` (${target.dataset.popupDate})` : ``);

        return `<div>` +
        		   `<p class="data-field title">${target.dataset.popupTitleHtml}</p>` +
        		   `<p class="data-field author-plus-date">${author}${date}</p>` +
        		   `<div class="data-field popupAbstract">${target.dataset.popupAbstract}</div>` +
        	   `</div>`;
    },
    youtubeId: (url) => {
        let match = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/);
        if (match && match[2].length == 11) {
            return match[2];
        } else {
            return null;
        }
    },
    isVideoLink: (target) => {
		let videoId = (target.tagName == "A") ? Extracts.youtubeId(target.href) : null;
		return (videoId != null);
    },
    videoForTarget: (target) => {
		GWLog("Extracts.videoForTarget", "extracts.js", 2);

		let videoId = Extracts.youtubeId(target.href);
		let videoEmbedURL = `https://www.youtube.com/embed/${videoId}`;
		let placeholderImgSrc = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
		let srcdocStyles = `<style>` + 
			`* { padding: 0; margin: 0; overflow: hidden; }` + 
			`html, body { height: 100%; } ` + 
			`img, span { position: absolute; width: 100%; top: 0; bottom: 0; margin: auto; } ` + 
			`span { height: 1.5em; text-align: center; font: 48px/1.5 sans-serif; color: white; text-shadow: 0 0 0.5em black; }` + 
			`</style>`;
		let playButtonHTML = `<span class='video-embed-play-button'>&#x25BA;</span>`;
		let srcdocHTML = `<a href='${videoEmbedURL}?autoplay=1'><img src='${placeholderImgSrc}'>${playButtonHTML}</a>`;

        return `<div><iframe src="${videoEmbedURL}" srcdoc="${srcdocStyles}${srcdocHTML}" frameborder="0" allowfullscreen></iframe></div>`;
    },
    nearestBlockElement: (element) => {
    	return element.closest("address, aside, blockquote, dd, dt, figure, footer, h1, h2, h3, h4, h5, h6, header, p, pre, section, table, tfoot, ol, ul");
    },
    sectionEmbedForTarget: (target) => {
		GWLog("Extracts.sectionEmbedForTarget", "extracts.js", 2);

        let targetElement = document.querySelector(target.getAttribute('href'));
        if (targetElement.tagName != "SECTION")
	        targetElement = Extracts.nearestBlockElement(targetElement);
		let sectionEmbedHTML = (targetElement.tagName == "SECTION") ? targetElement.innerHTML : targetElement.outerHTML;

        return `<div>${sectionEmbedHTML}</div>`;
    },
    isExternalSectionLink: (target) => {
    	if (target.tagName != "A")
    		return false;

		let targetHref = target.getAttribute("href");
		return targetHref.match(/^\/[^\.]+?#.+$/) != null;
    },
    externalSectionEmbedForTarget: (target) => {
		GWLog("Extracts.externalSectionEmbedForTarget", "extracts.js", 2);

		doAjax({
			location: target.href,
			onSuccess: (event) => {
				if (!target.popup)
					return;

				target.popup.innerHTML = `<div>${event.target.responseText}</div>`;
				requestAnimationFrame(() => {
					let targetElement = target.popup.querySelector(target.hash);
					if (targetElement.tagName != "SECTION")
						targetElement = Extracts.nearestBlockElement(targetElement);
					let sectionEmbedHTML = (targetElement.tagName == "SECTION") ? targetElement.innerHTML : targetElement.outerHTML;
					target.popup.innerHTML = `<div>${sectionEmbedHTML}</div>`;

					/*  Because the Popups.popupDidSpawn event has already fired,
						we must process the newly-constructed popup manually,
						to enable recursive popups within.
						*/
					requestAnimationFrame(() => {
						//  But first, qualify internal links in the popup.
						Extracts.qualifyLinksInPopContent(target.popup, target);
						//  Now process targets in the popup.
						Popups.addTargetsWithin(target.popup, Extracts.targets, Extracts.preparePopup, Extracts.prepareTargetForPopups);
					});
				});
			},
			onFailure: (event) => {
				//  TODO: Inject some sort of "not found" message
			}
		});

		return `<div></div>`;
    },
    citationContextForTarget: (target) => {
		GWLog("Extracts.citationContextForTarget", "extracts.js", 2);

        let targetCitation = document.querySelector(target.getAttribute('href'));
        let citationContextBlockElement = Extracts.nearestBlockElement(targetCitation);
		let citationContextHTML = (citationContextBlockElement.tagName == "SECTION") ? citationContextBlockElement.innerHTML : citationContextBlockElement.outerHTML;

        return `<div>${citationContextHTML}</div>`;
    },
    isLocalImageLink: (target) => {
    	if (target.tagName != "A")
    		return false;

		let targetHref = target.getAttribute("href");
		let imageFileURLRegExp = new RegExp('^\\/.*(' + Extracts.imageFileExtensions.map(ext => `\\.${ext}`).join("|") + ')', 'i');

		return targetHref.startsWith("/images/") || (targetHref.match(imageFileURLRegExp) != null);
    },
    localImageForTarget: (target) => {
		GWLog("Extracts.localImageForTarget", "extracts.js", 2);

        //  TEMPORARY!!
//         let href = target.getAttribute("href");
// 		return `<div><img class="${target.classList}" src="https://www.gwern.net${href}" loading="lazy"></div>`;
        //  Note that we pass in the original image-link’s classes - this is good for classes like ‘invertible’.
        return `<div><img class="${target.classList}" src="${target.href}" loading="lazy"></div>`;
    },
    isLocalDocumentLink: (target) => {
	    return (target.tagName == "A" && target.getAttribute("href").startsWith("/docs/www"));
    },
    localDocumentForTarget: (target) => {
		GWLog("Extracts.localDocumentForTarget", "extracts.js", 2);

		//  TEMPORARY!!
// 		return null;
// 		let href = target.getAttribute("href");
// 		return `<div><object data="https://www.gwern.net${href}"></object></div>`;
		return `<div><object data="${target.href}"></object></div>`;
    },
    isLocalCodeFileLink: (target) => {
    	if (target.tagName != "A")
    		return false;

		let targetHref = target.getAttribute("href");
		let codeFileURLRegExp = new RegExp('^\\/.*(' + Extracts.codeFileExtensions.map(ext => `\\.${ext}`).join("|") + ')', 'i');

		return targetHref.match(codeFileURLRegExp) != null;
    },
    localCodeFileForTarget: (target) => {
		GWLog("Extracts.localCodeFileForTarget", "extracts.js", 2);

		doAjax({
			location: target.href + ".html",
			onSuccess: (event) => {
				if (target.popup)
					target.popup.innerHTML = event.target.responseText;
			},
			onFailure: (event) => {
				doAjax({
					location: target.href,
					onSuccess: (event) => {
						if (target.popup) {
							let htmlEncodedResponse = event.target.responseText.replace(/[<>]/g, c => ('&#' + c.charCodeAt(0) + ';'));
							target.popup.innerHTML = `<pre><code>${htmlEncodedResponse}</code></pre>`;
						}
					},
					onFailure: (event) => {
						//  TODO: Inject some sort of "not found" message
					}
				});
			}
		});

		return `<div></div>`;
    },
    qualifyLinksInPopContent: (popX, target) => {
		let targetHref = target.getAttribute("href");
		popX.querySelectorAll("a[href^='#']").forEach(anchorLink => {
			anchorLink.setAttribute("href", targetHref.match(/^([^#]+)/)[1] + anchorLink.hash);
		});
    },

	/***********/
	/*	General.
		*/
	isMobile: () => {
		/*  We consider a client to be mobile if one of two conditions obtain:
		    1. JavaScript detects touch capability, AND viewport is narrow; or,
		    2. CSS does NOT detect hover capability.
		    */
// 		return true;
		return (   (   ('ontouchstart' in document.documentElement)
					&& GW.mediaQueries.mobileWidth.matches)
				|| !GW.mediaQueries.hoverAvailable.matches);
	},
    cleanup: () => {
		GWLog("Extracts.cleanup", "extracts.js", 1);

		//  Target restore function (same for mobile and non-mobile).
		let restoreTarget = (target) => {
			if (target.dataset.attributeTitle) {
				//  Restore the title attribute, saved in `data-attribute-title`.
				target.title = target.dataset.attributeTitle;
				//  Remove the data attribute.
				target.removeAttribute("data-attribute-title");
			}

			target.classList.toggle("has-content", false);
			target.classList.toggle("has-annotation", false);
		};

		if (Extracts.isMobile()) {
			//  TEMPORARY!!
			return;

			//  Restore targets and remove popins.
			document.querySelectorAll(Extracts.contentContainersSelector).forEach(container => {
				Popins.removeTargetsWithin(container, Extracts.targets, restoreTarget);
			});

			//  Remove event handler for newly-spawned popups.
			GW.notificationCenter.removeHandlerForEvent("Popups.popinDidInject", Extracts.popinInjectHandler);
		} else {
			//  Remove “popups disabled” icon/button, if present.
			Extracts.removePopupsDisabledShowPopupOptionsDialogButton();

			//  Unbind event listeners, restore targets, and remove popups.
			document.querySelectorAll(Extracts.contentContainersSelector).forEach(container => {
				Popups.removeTargetsWithin(container, Extracts.targets, restoreTarget);
			});

			//  Remove event handler for newly-spawned popups.
			GW.notificationCenter.removeHandlerForEvent("Popups.popupDidSpawn", Extracts.popupSpawnHandler);
		}
    },
    setup: () => {
		GWLog("Extracts.setup", "extracts.js", 1);

        //  Run cleanup.
        Extracts.cleanup();

		//  Shared target prepare function (for both mobile and non-mobile).
		let sharedPrepareTarget = (target) => {
			if (target.title) {
				//  Preserve the title attribute, for possible restoration later.
				target.dataset.attributeTitle = target.title;
			}

			if (   Extracts.isVideoLink(target)
				|| Extracts.isLocalImageLink(target)
				|| Extracts.isLocalDocumentLink(target)
				|| Extracts.isLocalCodeFileLink(target)
				|| Extracts.isExternalSectionLink(target)) {
				target.classList.toggle("has-content", true);
			}
		};

        if (Extracts.isMobile()) {
			//  TEMPORARY!!
			return;

            GWLog("Mobile client detected. Injecting pop-ins.", "extracts.js", 1);

			//  Set up targets.
			Extracts.prepareTargetForPopins = (target) => {
				sharedPrepareTarget(target);

				//  Alter the title attribute.
				target.title = "Click to reveal";
			};

			//  Recursively inject popins within newly-injected popin as well.
			GW.notificationCenter.addHandlerForEvent("Popins.popinDidInject", Extracts.popinInjectHandler = (info) => {
				Popins.addTargetsWithin(info.popin, Extracts.targets, Extracts.preparePopin, Extracts.prepareTargetForPopins);
			});

			//  Inject popins.
			document.querySelectorAll(Extracts.contentContainersSelector).forEach(container => {
				Popins.addTargetsWithin(container, Extracts.targets, Extracts.preparePopin, Extracts.prepareTargetForPopins);
			});
        } else {
            GWLog("Non-mobile client detected. Activating popups.", "extracts.js", 1);

			if (localStorage.getItem("extract-popups-disabled") == "true") {
				//  Inject “popups disabled” icon/button.
				Extracts.injectPopupsDisabledShowPopupOptionsDialogButton();
				return;
			}

			//  Set up targets.
			Extracts.prepareTargetForPopups = (target) => {
				sharedPrepareTarget(target);

				//  Remove the title attribute.
				target.removeAttribute("title");
			};
			document.querySelectorAll(Extracts.contentContainersSelector).forEach(container => {
				Popups.addTargetsWithin(container, Extracts.targets, Extracts.preparePopup, Extracts.prepareTargetForPopups);
			});

			//  Recursively set up targets within newly-spawned popups as well.
			GW.notificationCenter.addHandlerForEvent("Popups.popupDidSpawn", Extracts.popupSpawnHandler = (info) => {
				Popups.addTargetsWithin(info.popup, Extracts.targets, Extracts.preparePopup, Extracts.prepareTargetForPopups);

				//  Remove click listener from code popups, to allow selection.
				if (info.popup.classList.contains("local-code-file-popup"))
					info.popup.removeEventListener("click", Popups.popupClicked);
			});
        }

		GW.notificationCenter.fireEvent("Extracts.setupDidComplete");
    },

	/**********/
	/*	Popins.
		*/
    fillPopin: (popin, target) => {
		GWLog("Extracts.fillPopin", "extracts.js", 2);

		//  Inject the contents of the popin into the popin div.
		if (Extracts.isVideoLink(target)) {
			//  Videos (both local and remote).
			popin.innerHTML = Extracts.videoForTarget(target);
			popin.classList.add("video-popin", "object-popin");
		} else if (target.classList.contains("footnote-ref")) {
			//  Citations.
			if (!target.hash)
				return false;

			//  This could be a footnote, or a sidenote!
			let targetNoteId = target.hash.substr(1);
			let targetNote = document.querySelector("#" + targetNoteId);
			if (!targetNote)
				return false;

			popin.innerHTML = `<div>${targetNote.innerHTML}</div>`;
			popin.targetNote = targetNote;
			popin.classList.add("footnote-popin");
		} else if (target.classList.contains("footnote-back")) {
			//  There are no citation-context popins.
			return false;
		} else if (target.tagName == "A" && target.getAttribute("href").startsWith("#")) {
			//  There are no section embed popins.
			return false;
		} else if (Extracts.isExternalSectionLink(target)) {
			//  Identified sections of another page on gwern.net.
			popin.innerHTML = Extracts.externalSectionEmbedForTarget(target);
			popin.classList.add("external-section-embed-popin");
		} else if (Extracts.isLocalImageLink(target)) {
			//  Locally hosted images.
			popin.innerHTML = Extracts.localImageForTarget(target);
			popin.classList.add("image-popin", "object-popin");
		} else if (target.classList.contains("docMetadata")) {
			//  Summaries of links to elsewhere.
			popin.innerHTML = Extracts.extractForTarget(target);
		} else if (target.classList.contains("defnMetadata")) {
			//  Definitions.
			popin.innerHTML = Extracts.definitionForTarget(target);
			popin.classList.add("definition-popin");
		} else if (Extracts.isLocalDocumentLink(target)) {
			//  Locally hosted documents (html, pdf, etc.).
			popin.innerHTML = Extracts.localDocumentForTarget(target);
			popin.classList.add("local-document-popin", "object-popin");
		} else if (Extracts.isLocalCodeFileLink(target)) {
			//  Locally hosted code files (css, js, hs, etc.).
			popin.innerHTML = Extracts.localCodeFileForTarget(target);
			popin.classList.add("local-code-file-popin", "object-popin");
		}

		return (popin.childElementCount != 0);
    },
    preparePopin: (popin, target) => {
		GWLog("Extracts.preparePopin", "extracts.js", 2);

		//  Import the class(es) of the target, and add some others.
		popin.classList.add(...target.classList, "extract-popin");

		//	Inject the extract for the target into the popin.
		if (Extracts.fillPopin(popin, target) == false)
			return false;

		//  Qualify internal links in extracts.
		if (popin.classList.contains("docMetadata") && target.getAttribute("href").startsWith("/"))
			Extracts.qualifyLinksInPopContent(popin, target);

		return true;
    },

	/**********/
	/*	Popups.
		*/
	popupOptionsDialog: null,
	popupsDisabledShowPopupOptionsDialogButton: null,
	disableExtractPopups: () => {
		GWLog("Extracts.disableExtractPopups", "extracts.js", 1);

		localStorage.setItem("extract-popups-disabled", "true");
		Extracts.cleanup();
		Extracts.injectPopupsDisabledShowPopupOptionsDialogButton();
	},
	enableExtractPopups: () => {
		GWLog("Extracts.enableExtractPopups", "extracts.js", 1);

		localStorage.removeItem("extract-popups-disabled");
		Extracts.setup();
		Extracts.removePopupsDisabledShowPopupOptionsDialogButton();
	},
	showPopupOptionsDialog: () => {
		GWLog("Extracts.showPopupOptionsDialog", "extracts.js", 1);

		//  Create the options dialog, if needed.
		if (Extracts.popupOptionsDialog == null) {
			let popupsEnabled = localStorage.getItem("extract-popups-disabled") != "true";
			let enabledRadioButtonChecked = popupsEnabled ? `checked=""` : ``;
			let disabledRadioButtonChecked = popupsEnabled ? `` : `checked=""`;
			Extracts.popupOptionsDialog = addUIElement(`<div id='popup-options-dialog' style='display: none;'><div>` + 
				`<h1>Popups</h1>` + 
				`<form class="option-buttons">
					<label>
						<input class="popups-enable" name="popups-enable-status" ${enabledRadioButtonChecked} value="enabled" type="radio">
						<span class='button-text'>
							<span class='label'>Enable</span>
							<span class='explanation'>Show popups when hovering over annotated links.</span>
						</span>
					</label>
					<label>
						<input class="popups-disable" name="popups-enable-status" ${disabledRadioButtonChecked} value="disabled" type="radio">
						<span class='button-text'>
							<span class='label'>Disable</span>
							<span class='explanation'>Don’t show popups.</span>
						</span>
					</label>
				</form>` +
				`<button type='button' class='close-button'><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 512"><path d="M193.94 256L296.5 153.44l21.15-21.15c3.12-3.12 3.12-8.19 0-11.31l-22.63-22.63c-3.12-3.12-8.19-3.12-11.31 0L160 222.06 36.29 98.34c-3.12-3.12-8.19-3.12-11.31 0L2.34 120.97c-3.12 3.12-3.12 8.19 0 11.31L126.06 256 2.34 379.71c-3.12 3.12-3.12 8.19 0 11.31l22.63 22.63c3.12 3.12 8.19 3.12 11.31 0L160 289.94 262.56 392.5l21.15 21.15c3.12 3.12 8.19 3.12 11.31 0l22.63-22.63c3.12-3.12 3.12-8.19 0-11.31L193.94 256z"/></svg></button>` + 
				`<button type='button' class='save-button'>Save</button>` + 
				`</div></div>`);
			//  Add event listeners.
			requestAnimationFrame(() => {
				Extracts.popupOptionsDialog.addEventListener("click", Extracts.popupOptionsDialogBackdropClicked = (event) => {
					GWLog("Extracts.popupOptionsDialogBackdropClicked", "extracts.js", 2);

					event.stopPropagation();
					Extracts.fadePopupOptionsDialog();
				});
				Extracts.popupOptionsDialog.firstElementChild.addEventListener("click", Extracts.popupOptionsDialogClicked = (event) => {
					GWLog("Extracts.popupOptionsDialogClicked", "extracts.js", 3);

					event.stopPropagation();
				});
				Extracts.popupOptionsDialog.querySelector("button.close-button").addActivateEvent(Extracts.popupOptionsDialogCloseButtonClicked = (event) => {
					GWLog("Extracts.popupOptionsDialogCloseButtonClicked", "extracts.js", 2);

					Extracts.fadePopupOptionsDialog();
				});
				Extracts.popupOptionsDialog.querySelector("button.save-button").addActivateEvent(Extracts.popupOptionsDialogSaveButtonClicked = (event) => {
					GWLog("Extracts.popupOptionsDialogSaveButtonClicked", "extracts.js", 2);

					Extracts.savePopupOptions();
					Extracts.fadePopupOptionsDialog();
				});
				document.addEventListener("keyup", Extracts.popupOptionsDialogKeyUp = (event) => {
					GWLog("Extracts.popupOptionsDialogKeyUp", "extracts.js", 3);

					let allowedKeys = [ "Escape", "Esc" ];
					if (!allowedKeys.includes(event.key) || Extracts.popupOptionsDialog.style.display == "none")
						return;

					event.preventDefault();
					Extracts.fadePopupOptionsDialog();
				});
			});
		}

		//  Un-hide the options dialog.
		Extracts.popupOptionsDialog.style.display = "";
	},
	fadePopupOptionsDialog: () => {
		GWLog("Extracts.fadePopupOptionsDialog", "extracts.js", 1);

		Extracts.popupOptionsDialog.classList.toggle("fading", true);
		setTimeout(Extracts.hidePopupOptionsDialog, 150);
	},
	hidePopupOptionsDialog: () => {
		GWLog("Extracts.hidePopupOptionsDialog", "extracts.js", 1);

		if (Extracts.popupOptionsDialog != null) {
			Extracts.popupOptionsDialog.style.display = "none";
			Extracts.popupOptionsDialog.classList.toggle("fading", false);
		}
	},
	savePopupOptions: () => {
		GWLog("Extracts.savePopupOptions", "extracts.js", 1);

		if (Extracts.popupOptionsDialog.querySelector("input.popups-enable").checked)
			Extracts.enableExtractPopups();
		else
			Extracts.disableExtractPopups();
	},
	injectPopupsDisabledShowPopupOptionsDialogButton: () => {
		GWLog("Extracts.injectPopupsDisabledShowPopupOptionsDialogButton", "extracts.js", 1);

		if (Extracts.popupsDisabledShowPopupOptionsDialogButton != null)
			return;

		//  Create and inject the button.
		Extracts.popupsDisabledShowPopupOptionsDialogButton = addUIElement(`<div id="popups-disabled-show-popup-options-dialog-button">` + 
			`<button type="button" title="Show options for link popups. (Popups are currently disabled.)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 512"><path d="M64 352c0 35.3 28.7 64 64 64h96v84c0 9.8 11.2 15.5 19.1 9.7L368 416h2L64 179.5V352zm569.8 106.1l-77.6-60c12.1-11.6 19.8-28 19.8-46.1V64c0-35.3-28.7-64-64-64H128c-21.5 0-40.4 10.7-52 27L45.5 3.4C38.5-2 28.5-.8 23 6.2L3.4 31.4c-5.4 7-4.2 17 2.8 22.4l588.4 454.7c7 5.4 17 4.2 22.5-2.8l19.6-25.3c5.4-6.8 4.1-16.9-2.9-22.3z"/></svg></button>` + `</div>`);

		//  Add event listener.
		requestAnimationFrame(() => {
			Extracts.popupsDisabledShowPopupOptionsDialogButton.addActivateEvent(Extracts.popupsDisabledShowPopupOptionsDialogButtonClicked = (event) => {
				GWLog("Extracts.popupsDisabledShowPopupOptionsDialogButtonClicked", "extracts.js", 2);

				event.stopPropagation();
				Extracts.showPopupOptionsDialog();
			});
		});
	},
	removePopupsDisabledShowPopupOptionsDialogButton: () => {
		GWLog("Extracts.removePopupsDisabledShowPopupOptionsDialogButton", "extracts.js", 1);

		if (Extracts.popupsDisabledShowPopupOptionsDialogButton == null)
			return;

		Extracts.popupsDisabledShowPopupOptionsDialogButton.remove();
		Extracts.popupsDisabledShowPopupOptionsDialogButton = null;
	},
    fillPopup: (popup, target) => {
		GWLog("Extracts.fillPopup", "extracts.js", 2);

		//  Inject the contents of the popup into the popup div.
		if (Extracts.isVideoLink(target)) {
			//  Videos (both local and remote).
			popup.innerHTML = Extracts.videoForTarget(target);
			popup.classList.add("video-popup", "object-popup");
		} else if (target.classList.contains("footnote-ref")) {
			//  Citations.
			if (!target.hash)
				return false;

			//  This could be a footnote, or a sidenote!
			let targetNoteId = target.hash.substr(1);
			let targetNote = document.querySelector("#" + targetNoteId);
			if (!targetNote)
				return false;

			popup.innerHTML = `<div>${targetNote.innerHTML}</div>`;
			popup.targetNote = targetNote;
			popup.classList.add("footnote-popup");
		} else if (target.classList.contains("footnote-back")) {
			//  Context surrounding a citation (displayed on footnote-back links).
			popup.innerHTML = Extracts.citationContextForTarget(target);
			popup.classList.add("citation-context-popup");
		} else if (   target.tagName == "A" 
				   && target.getAttribute("href").startsWith("#")) {
			//  Identified sections of the current page.
			popup.innerHTML = Extracts.sectionEmbedForTarget(target);
			popup.classList.add("section-embed-popup");
			if (target.closest("#TOC"))
				popup.classList.add("toc-section-popup");
		} else if (Extracts.isExternalSectionLink(target)) {
			//  Identified sections of another page on gwern.net.
			popup.innerHTML = Extracts.externalSectionEmbedForTarget(target);
			popup.classList.add("external-section-embed-popup");
		} else if (Extracts.isLocalImageLink(target)) {
			//  Locally hosted images.
			popup.innerHTML = Extracts.localImageForTarget(target);
			popup.classList.add("image-popup", "object-popup");
		} else if (target.classList.contains("docMetadata")) {
			//  Summaries of links to elsewhere.
			popup.innerHTML = Extracts.extractForTarget(target);
		} else if (target.classList.contains("defnMetadata")) {
			//  Definitions.
			popup.innerHTML = Extracts.definitionForTarget(target);
			popup.classList.add("definition-popup");
		} else if (Extracts.isLocalDocumentLink(target)) {
			//  Locally hosted documents (html, pdf, etc.).
			popup.innerHTML = Extracts.localDocumentForTarget(target);
			popup.classList.add("local-document-popup", "object-popup");
		} else if (Extracts.isLocalCodeFileLink(target)) {
			//  Locally hosted code files (css, js, hs, etc.).
			popup.innerHTML = Extracts.localCodeFileForTarget(target);
			popup.classList.add("local-code-file-popup", "object-popup");
		}

		return (popup.childElementCount != 0);
    },
    preparePopup: (popup, target) => {
		GWLog("Extracts.preparePopup", "extracts.js", 2);

		//  Import the class(es) of the target, and add some others.
		popup.classList.add(...target.classList, "extract-popup", "markdownBody");
		//  We then remove some of the imported classes.
		popup.classList.remove("has-content", "spawns-popup");

		//	Inject the extract for the target into the popup.
		if (Extracts.fillPopup(popup, target) == false)
			return false;

		if (popup.classList.contains("footnote-popup")) {
			//  Do not spawn footnote popup if sidenote is visible.
			if (GW.sidenotes != null
				&& !GW.sidenotes.mediaQueries.viewportWidthBreakpoint.matches
				&& isOnScreen(popup.targetNote))
				return false;

			/*  Add event listeners to highlight citation when its footnote
				popup is spawned.
				*/
			popup.addEventListener("mouseenter", (event) => {
				target.classList.toggle("highlighted", true);
			});
			popup.addEventListener("mouseleave", (event) => {
				target.classList.toggle("highlighted", false);
			});
			GW.notificationCenter.addHandlerForEvent("Popups.popupWillDespawn", Extracts.footnotePopupDespawnHandler = (info) => {
				target.classList.toggle("highlighted", false);
			});
		} else if (popup.classList.contains("citation-context-popup")) {
			//  Do not spawn citation context popup if citation is visible.
			if (isOnScreen(document.querySelector("#markdownBody " + target.getAttribute("href"))))
				return false;

			//  Remove the .targeted class from a targeted citation (if any).
			popup.querySelectorAll(".footnote-ref.targeted").forEach(targetedCitation => {
				targetedCitation.classList.remove("targeted");
			});

			//  Highlight citation in a citation context popup.
			popup.querySelector(target.getAttribute("href")).classList.add("highlighted");
		} else if (popup.classList.contains("toc-section-popup")) {
			//  Special positioning for section links spawned by the TOC.
			target.popupSpecialPositioningFunction = (preparedPopup, popupTarget, mouseEvent) => {
				let popupContainerViewportRect = Popups.popupContainer.getBoundingClientRect();
				let mouseEnterEventPositionInPopupContainer = {
					x: (mouseEvent.clientX - popupContainerViewportRect.left),
					y: (mouseEvent.clientY - popupContainerViewportRect.top)
				};

				var popupIntrinsicHeight = preparedPopup.offsetHeight;

				let provisionalPopupXPosition = document.querySelector("#TOC").getBoundingClientRect().right + 1.0 - popupContainerViewportRect.left;
				let provisionalPopupYPosition = mouseEnterEventPositionInPopupContainer.y - ((mouseEvent.clientY / window.innerHeight) * popupIntrinsicHeight);

				return [ provisionalPopupXPosition, provisionalPopupYPosition ];
			}
		}

		//  Fix full-width figures.
		popup.querySelectorAll(".caption-wrapper").forEach(captionWrapper => {
			captionWrapper.style.minWidth = "";
		});
		popup.querySelectorAll(".full-width").forEach(fullWidthBlock => {
			fullWidthBlock.style.marginLeft = "";
			fullWidthBlock.style.marginRight = "";
		});

		//  Expand collapsed code blocks and then re-rectify heights.
		popup.querySelectorAll("pre code").forEach(codeBlock => {
			codeBlock.style.height = "";
			requestAnimationFrame(() => {
				rectifyCodeBlockHeight(codeBlock);
			});
		});

		//  Rectify margin note style.
		popup.querySelectorAll(".marginnote").forEach(marginNote => {
			marginNote.classList.add("inline");
			marginNote.classList.remove("sidenote");
		});

		//  Qualify internal links in extracts.
		if (popup.classList.contains("docMetadata") && target.getAttribute("href").startsWith("/"))
			Extracts.qualifyLinksInPopContent(popup, target);

		return true;
    }
};

doWhenPageLoaded(() => {
	GW.notificationCenter.fireEvent("Extracts.didLoad");

	let serviceProviderObjectName = Extracts.isMobile() ? "Popins" : "Popups";

	if (window[serviceProviderObjectName])
		Extracts.setup();
	else
		GW.notificationCenter.addHandlerForEvent(serviceProviderObjectName + ".setupDidComplete", () => {
			Extracts.setup();
		}, { once: true });
});
