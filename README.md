# Torn Item Market – Shop Sell Price Highlighter

A userscript for [Torn](https://www.torn.com) that highlights Item Market listings priced **below what a city shop pays for the item**. Buy them, sell them to Big Al's (or any other city shop), pocket the difference.

Works in the browser with Tampermonkey / Violentmonkey and on the phone in [Torn PDA](https://github.com/Manuito83/torn-pda).

![Highlighted listings on the Item Market](pics/2026-10-16_19-01.png)

## What it does

Every listing on the Item Market is compared against the fixed price a city shop pays for that item. If the market price is lower, the listing gets a coloured border and a coloured dot next to the price. The colour tells you how much profit per unit you would make:

| Colour | Profit per unit |
| ------ | --------------- |
| Green  | 50,000 or more  |
| Yellow | 10,000 – 49,999 |
| Red    | 1,000 – 9,999   |
| Blue   | 1 – 999         |

Hover (or long-press) the dot to see the item name, the shop price and the exact profit.

## Install

### Browser (Tampermonkey / Violentmonkey)

1. Install [Tampermonkey](https://www.tampermonkey.net/) or [Violentmonkey](https://violentmonkey.github.io/).
2. Open the install link: **[torn-market-shop-price-highlighter.user.js](https://raw.githubusercontent.com/tulpn/torn-market-sell-check/main/torn-market-shop-price-highlighter.user.js)**
3. Confirm the install. Open the Item Market and you are done.

### Torn PDA

1. In Torn PDA go to **Settings → Userscripts → Add**.
2. Paste the raw URL above and save.
3. Open the Item Market inside the app.

No API key is needed. The script never asks for one and never makes a network request.

## How it works

1. **Shop sell prices are static**, so they are baked straight into the script as a lookup table (item ID → shop sell price). Items that no shop will buy are left out. The table is generated once with `build-prices.ps1` from the official Torn API and committed with the script.
2. **Listings are found by their item image.** Every listing on the Item Market carries an image whose URL contains the item ID. The script reads that ID and takes the nearest `$1,234` text as the listing price. No fragile class-name selectors, so Torn's regular UI reshuffles rarely break it.
3. **Profit = shop price − market price.** The result is matched against the colour tiers and the listing is decorated. A `MutationObserver` re-scans as you page through listings or switch categories.

## Torn rules

This script is designed to stay within Torn's scripting rules. It only reads the Item Market page you have opened yourself. It sends no requests to torn.com, performs no actions on your behalf, and cannot buy, sell or click anything. The Torn API is used only by the maintainer's build step to generate the price table, never at runtime.

Rules can change, and the final responsibility for what runs in your browser is yours. Read the current rules at [torn.com/rules.php](https://www.torn.com/rules.php) before installing any script.

## Configuration

The colour tiers live at the top of the script in the `CONFIG` block and can be changed for personal use:

```js
tiers: [
  { min: 50000, color: '#2ecc71', label: 'green' },
  { min: 10000, color: '#f1c40f', label: 'yellow' },
  { min: 1000,  color: '#e74c3c', label: 'red' },
  { min: 1,     color: '#3b1ee0', label: 'blue' },
],
```

`min` is the per-unit profit a listing must reach to get that tier. Listings below the lowest `min` are not highlighted. Add, remove or reorder tiers as you like; the script sorts them itself.

## Refreshing the price table

Torn very occasionally rebalances item values. To regenerate the embedded table, run from the repository folder:

```powershell
.\build-prices.ps1 -ApiKey YOUR_TORN_API_KEY
```

A key with **Public** access is enough. The script fetches `torn/items` once, rewrites the table between the `@@SHOP_PRICES_START` / `@@SHOP_PRICES_END` markers, and leaves everything else untouched. The key is only used by this build step and never ends up in the userscript.

## Known limitations

- Torn's Item Market is a React app with hashed class names. The script locates listings heuristically (image + nearest price), which is robust but not infallible. If a listing shows more than one dollar amount, the first one wins.
- Only the shop sell price is considered. Your own sell-related perks or events that temporarily change shop prices are not factored in.

## Like the script?

If this script saves you money, please **give the [forum post](https://www.torn.com/forums.php#/p=threads&f=67&t=16611888&b=0&a=0&start=0&to=28029671) an upvote or leave a comment**. It helps me a lot and keeps the script visible for other players.

## More scripts

More Torn scripts will be published at **[www.torn-tracker.com/scripts](https://www.torn-tracker.com/scripts)**.

## Author & custom scripts

Written by **ares313377** – [Torn profile, ID 4372940](https://www.torn.com/profiles.php?XID=4372940).

Need a script tailored to your faction, your trading routine or anything else in Torn? Custom scripts can be ordered as needed, with pricing depending on scope.

- Read the service offering and ask questions in the **[Torn forum thread](https://www.torn.com/forums.php#/p=threads&f=67&t=16611888&b=0&a=0&start=0&to=28029671)**.
- Or send a message in game to [ares313377 [4372940]](https://www.torn.com/profiles.php?XID=4372940).

## License

This script may be used and redistributed **as is**, but **not modified** or redistributed in modified form. Adjusting the `CONFIG` values for your own use is allowed. See [LICENSE](LICENSE) for the full terms.
