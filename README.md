# Baska: shared shopping checklist

Baska is a shared list of things to buy. Each item records who added it and which store to get it at. It is built for a phone in one hand in the store (fast check-off, big tap targets, a docked "Add an item…" box) and works on desktop for planning (sidebar with stats, stores and people).

## Features

- One list grouped **by store**, **by person** or **not grouped**. Group headers collapse.
- Store filter chips (`All · 6`, `Costco · 3`, …) with pending counts.
- Quick-add composer. Press Enter to add with the defaults (1 unit, the last person, the last or filtered store). The options button opens quantity, unit, person and store.
- Check-off animation, a progress ring in the header, and an undo toast after checking off or deleting an item.
- Item details open in a drawer on desktop (≥900px) and a bottom sheet on mobile. Fields: option, quantity, unit, store, note and message. Changes save as you type.
- Stores: add, delete (asks in an in-app dialog first) and filter. Stores that only appear on items are listed too, but can't be deleted.
- A Completed section with "Clear completed" and undo.
- Nearby-store alerts: geolocation plus a Google Places text search within 3 miles, throttled to one alert every 5 minutes.
- Light and dark themes. The app follows the system setting until you flip the toggle.
- Keyboard: `/` or `N` jumps to the add box. Esc closes dialogs.
- Voice input: tap the mic in the add box and say the item. See "Voice input" below.
- Low-vision support in item details: a large preview (the item's photo, or its name in big type), **Read aloud**, and an optional "Read items aloud when I open them" setting. See "Item preview and read aloud" below.

## Tips & help (the bulb)

A round amber bulb button floats in the bottom-right corner. On phones it sits above the docked add box and moves out of the way of toasts and the keyboard. It opens **Tips & help**:

- **Right now:** one suggestion based on the current list, with a button that does it. The suggestions are: load demo items when the list is empty, show items without a store, clear ticked-off items, or share the list.
- **Tips:** short explanations of each feature with a **Show me** button that jumps there: add, voice, details / photo / read aloud, share, filter and group, stores and alerts, theme. Tips that need items stay hidden until there are some.
- **Keyboard:** `/` or `N` to add, `?` to open the tips, `Esc` to close.

The bulb glows gently until it's opened once. **Hide the bulb button** removes it; **Summary → Tips & help** always opens the panel and brings the bulb back. Both choices are saved in the UI prefs (`helpSeen`, `helpHidden`).

## Sharing

**Share** (list header) opens a dialog that follows the current grouping and store filter. The share icon on any store or person group header opens it with just that group selected.

- **By store / By person / Everything:** pick one or more stores or people with the chips (each shows its to-buy count), or share the whole list grouped by store.
- **Options:** include ticked-off items; include notes and messages.
- **Send:** **Share…** opens the phone's share menu (Web Share API, shown only where the browser supports it), **Copy** puts the text on the clipboard, and **WhatsApp** and **Email** open with the text filled in.

The list is shared as plain text, so it reads well in any chat or email app:

```
Shopping list · Costco
2 items to buy · Nov 6, 2026

COSTCO (2 to buy)
☐ HDMI Cable — 2 units · Urgent
    Note: 2 metre, braided
☐ Milk — 2 units

— shared from Baska
```

Nothing is uploaded: the text goes only where you send it. Shared text can't be imported back into the app. Live shared lists need the sync backend planned for the native app.

## Item preview and read aloud

Opening an item shows a large preview at the top of the details drawer:

- **Photo:** "Add photo" opens the camera on phones, or a file picker on desktop. Photos are shrunk to at most 640px and saved as JPEG, about 20–60 KB each, under their own storage key `itemChecklistDashboard.photos` (`{ itemId: dataURL }`). The items data keeps its original shape. A small thumbnail also appears on the item's row. "Remove photo" has an Undo.
- **No photo:** the item name is shown in large, high-contrast type on a coloured tile.
- **Read aloud:** speaks the item with the browser's built-in text-to-speech: name, quantity, whether it's still to buy, store, tag, who added it, note and message. Tap again to stop. Closing the drawer stops it too.
- **Read items aloud when I open them:** a checkbox in the drawer. When it's on, every item is read as soon as it opens. The choice is saved with the other display settings.

Browsers give each site about 5 MB of storage. If it runs out, the app says so and keeps the item without the photo. Photos of deleted items are cleared the next time the app opens, so Undo still works until then.

## Voice input

Tap the mic button next to the add box and speak. The item is added as soon as you stop talking, with an Undo toast. The app understands:

- **Quantity:** digits or words: "3 bananas", "two", "a dozen eggs", "one and a half".
- **Unit:** "box / boxes / pack / carton / case" sets Box; "unit / piece" sets Unit. "of" after the unit is skipped.
- **Store:** "… from Costco" or "… at Target". A spoken store matches your existing stores ("Costco wholesale" → Costco); otherwise it's used as said. It applies to that item only.
- **Lead-in words** like "add", "buy", "I need", "we're out of" are ignored.

Example: "Two boxes of printer paper from Costco" → 2 boxes · Printer paper · Costco.

It uses the browser's built-in speech recognition (Web Speech API), which works in Chrome, Edge and Safari. In other browsers, such as Firefox, the mic button is hidden. Chrome and Edge send the audio to their speech service, so it needs an internet connection. The browser asks for microphone permission the first time. When the page is opened straight from disk (`file://`), Chrome may ask again on every visit; serving the folder (see "Opening it") avoids that.

## Opening it

No build step and no install. Open `index.html` in a modern browser. Double-clicking it (`file://`) works, because the scripts are classic `<script defer>` files, not ES modules. You can also serve the folder with any static server, for example:

```
python -m http.server 8000
```

then visit http://localhost:8000/.

## Google Maps API key

Nearby-store alerts need the Google Maps JavaScript API with the Places library. In `index.html`, replace `YOUR_API_KEY` in this tag:

```html
<script src="https://maps.googleapis.com/maps/api/js?key=YOUR_API_KEY&libraries=places"></script>
```

Without a valid key, everything else still works. The location card says that store lookup is unavailable, and no alerts fire.

## Folder structure

```
index.html                 markup, inline SVG icon sprite, CSS/JS includes, Maps script tag
assets/css/tokens.css      color / type / radius tokens; dark theme ([data-theme] + prefers-color-scheme)
assets/css/base.css        reset, typography, focus rings, icon defaults, reduced motion
assets/css/components.css  buttons, inputs, composer, chips, rows + checkbox, panels, toast, banner, drawer/sheet, dialog
assets/css/layout.css      app shell, sidebar, bottom tab bar, breakpoints (loaded last)
assets/js/storage.js       localStorage load/save (keys + sanitizing from the original app), UI prefs
assets/js/utils.js         ids, pluralisation, avatar hue, escaping, DOM helpers, stepper + focus trap
assets/js/state.js         shared state + actions: toggle, delete/undo, store add/delete, derived data
assets/js/render.js        list grouping, rows, chips, progress ring, stats, people, empty states, toast
assets/js/details.js       details drawer / bottom sheet, autosave
assets/js/preview.js       item preview (photo / large name), read aloud, auto-read setting, photo add/remove
assets/js/stores.js        stores panel + in-app confirm dialog
assets/js/location.js      geolocation + Places proximity check, banner + browser notification
assets/js/app.js           composer, view/tab switching, theme, demo data, event wiring, shortcuts, init
assets/js/help.js          floating bulb helper: context tip, feature tips with "Show me" actions, shortcuts
assets/js/share.js         share dialog: by store / by person / everything, plain-text list, share menu / copy / WhatsApp / email
assets/js/voice.js         mic button: speech recognition + phrase parsing (quantity, unit, item, store)
```

All scripts share one namespace object, `window.Baska`. Mutable state lives in `Baska.state`. Load order matters and is set in `index.html`.

## Data and storage

Data stays in this browser's `localStorage`. Nothing is sent to a server, apart from the Places lookups when alerts are on. The keys and data shape are the same as in the original `items_checklist_dashboard.html`, so existing lists carry over:

| Key | Contents |
| --- | --- |
| `itemChecklistDashboard.v1` | items: `{id, name, qty, done, addedBy, note, option, message, store, unit}` |
| `itemChecklistDashboard.stores` | stores: `[{name}]` |
| `itemChecklistDashboard.v1.lastUser` | the last "added by" name |
| `itemChecklistDashboard.ui` (new) | grouping mode, theme, collapsed groups, active filter, last store |

"Shared" means shared within one browser profile. Changes made in another tab of the same browser sync automatically. There is no sync between devices.
