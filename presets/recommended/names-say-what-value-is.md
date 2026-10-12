---
languages: [typescript, javascript, php, python, ruby, go, rust, java, kotlin, swift, csharp]
---
# Names say what the value is

A variable, parameter or function name says what the value is or what the function does, in words from the domain. A reader should not need to read the assignment to know what the name holds.

Flag names such as `data`, `result`, `res`, `tmp`, `obj`, `val`, `info`, `item`, `x` or single letters when they hold a domain value, abbreviations a newcomer cannot expand, and names that say the opposite of or less than what the value is. Do not flag loop indexes `i`, `j`, conventional names such as `e` for a caught error or `_` for an unused value, or a short name used within two or three lines of its definition in a tiny lambda.

## Bad

```ts
const data = await fetch(`/api/invoices?status=open`).then((r) => r.json());
const res = data.filter((x) => x.dueAt < now);
```

```python
def calc(u, d):
    tmp = d * u.rate
    return tmp
```

## Good

```ts
const openInvoices = await fetch(`/api/invoices?status=open`).then((response) => response.json());
const overdueInvoices = openInvoices.filter((invoice) => invoice.dueAt < now);
```

```python
def fee_for(user, days):
    return days * user.rate
```
