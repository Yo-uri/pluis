---
languages: [typescript, javascript, php, python, ruby, go, rust, java, kotlin, swift, csharp]
---
# Blank line between steps

Inside a function body, separate distinct steps with one blank line so a reader sees where one step ends and the next begins. A step is a group of statements that together do one thing: gather input, compute, check, act, return.

Flag a function body of more than four statements that has no blank line at all, and a run of statements that mixes two clearly different steps without a blank line between them. Do not flag short functions, a guard clause directly followed by its return, or statements that form one step.

## Bad

```ts
async function publish(id: string) {
  const post = await posts.find(id);
  if (!post) throw new NotFound(id);
  const html = render(post.markdown);
  const slug = slugify(post.title);
  await storage.put(`${slug}.html`, html);
  await posts.update(id, { publishedAt: new Date() });
  return slug;
}
```

## Good

```ts
async function publish(id: string) {
  const post = await posts.find(id);
  if (!post) throw new NotFound(id);

  const html = render(post.markdown);
  const slug = slugify(post.title);

  await storage.put(`${slug}.html`, html);
  await posts.update(id, { publishedAt: new Date() });

  return slug;
}
```
