---
languages: [typescript, javascript, php, python, ruby, go, rust, java, kotlin, swift, csharp]
---
# One step per statement

Each statement does one step. When calls are stacked inside each other's arguments, or a single statement filters, transforms, formats and returns at once, the reader has to unwind it from the inside out. Give each intermediate result its own statement and a name.

Flag calls nested three or more deep as arguments, and statements that chain several unrelated operations whose intermediate results deserve a name. Do not flag a fluent chain that reads top to bottom as one operation, such as a query builder or a short `map` and `filter` over one list.

## Bad

```ts
return send(format(pick(await load(userId), ["name", "email"]), locale), channel);
```

```php
$total = round(array_sum(array_map(fn ($line) => $line->price * $line->quantity, array_filter($order->lines, fn ($line) => !$line->cancelled))), 2);
```

## Good

```ts
const user = await load(userId);
const contact = pick(user, ["name", "email"]);
const message = format(contact, locale);

return send(message, channel);
```

```php
$activeLines = array_filter($order->lines, fn ($line) => !$line->cancelled);
$lineTotals = array_map(fn ($line) => $line->price * $line->quantity, $activeLines);
$total = round(array_sum($lineTotals), 2);
```
