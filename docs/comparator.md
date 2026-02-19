# Item Comparison

## Why comparison matters

The collection needs to know when two items represent "the same thing." This is essential for:

- **Upserting**: when `update()` or `readOne()` returns an item, the library finds the existing item in the collection and replaces it.
- **Deduplication**: preventing the same item from appearing twice in the collection.
- **Item-level tracking**: knowing which items are currently being updated, deleted, or refreshed.
- **Lookups**: `getItem()`, `getItemByPartial()`, and `hasItemIn()` all rely on comparison.

## Default behavior

By default, the comparator uses the fields `['id', 'uuId']`. This means two objects are considered equal if they share a matching `id` or `uuId` value.

If you don't configure a comparator and your items use different field names, you'll see a development-mode warning reminding you to set one.

## Configuring comparator fields

The most common approach is to specify which fields identify your items:

```ts
// In constructor
const collection = new Collection<Product>({ comparatorFields: ['id'] });

// Or in an @Injectable subclass
@Injectable()
export class ProductsCollection extends Collection<Product> {
  constructor() {
    super({ comparatorFields: ['id'] });
  }
}
```

You can also change it later:

```ts
// Via setOptions()
collection.setOptions({ comparatorFields: ['uuId', 'url'] });

// Via setComparator() with a new Comparator instance
collection.setComparator(new Comparator(['signature']));
```

## Field types

### Single string field

A single string identifies one field to compare. If both objects have this field with non-empty, equal values, they're considered equal:

```ts
{ comparatorFields: ['id'] }

// { id: 1, name: 'A' } and { id: 1, name: 'B' } → equal (same id)
// { id: 1 } and { id: 2 } → not equal (different id)
```

When comparing by a single field: if both objects have the field but the values differ, the comparison **stops immediately** — no further fields in the list are checked. This prevents false positives from unrelated ID schemes.

### Multiple fields in the list

You can provide multiple fields. They are checked in order, and the first field found on both objects determines the result:

```ts
{ comparatorFields: ['uuId', 'id', 'slug'] }
```

With this configuration:
- If both objects have `uuId`, compare by `uuId`. If values match, they're equal. If not, they're **not equal** (stops here).
- If neither has `uuId` but both have `id`, compare by `id`.
- If neither has `uuId` or `id` but both have `slug`, compare by `slug`.

### Composite key (array of strings)

An array within the fields list means **all listed fields must match** for equality:

```ts
{ comparatorFields: [['firstName', 'lastName', 'birthDate']] }

// Both firstName, lastName, AND birthDate must be equal
```

You can mix single fields and composite keys:

```ts
{ comparatorFields: ['uuId', ['firstName', 'lastName']] }
// First try uuId alone, then try the firstName+lastName combination
```

### Dot-notation for nested fields

Fields support dot-notation to access nested properties:

```ts
{ comparatorFields: ['address.zipCode'] }

// Compares obj1.address.zipCode with obj2.address.zipCode
```

## Empty values

Values that are "empty" are never considered equal, even to each other. Empty values include:

- `null`
- `undefined`
- `NaN`
- empty string (`''`)
- empty array (`[]`)
- empty object (`{}`)

This prevents false matches on unset fields. For example, two items with `id: undefined` are **not** considered equal.

## Custom comparator function

For full control, provide a function instead of fields:

```ts
collection.setComparator((a, b) => a.id === b.id);
```

Or use the `comparator` constructor option:

```ts
new Collection<Product>({
  comparator: { equal: (a, b) => a.slug === b.slug },
});
```

The function receives two objects and should return `true` if they represent the same item.

## Item lookup methods

### `hasItemIn(item, array)`

Checks if an item exists in an array, using the comparator:

```html
<mat-chip-option
  *ngFor="let role of allRoles()"
  [selected]="collection.hasItemIn(role, selectedRoles())"
>
  {{ role.name }}
</mat-chip-option>
```

### `getItem(filter, equalFn?)`

Returns a computed Signal containing the matching item from the collection. The `filter` can be a partial object or a Signal:

```ts
// Static lookup
readonly product = collection.getItem({ id: 42 });

// Reactive lookup (e.g., from route params)
readonly productId = signal<Partial<Product> | undefined>(undefined);
readonly product = collection.getItem(this.productId);
```

The optional `equalFn` controls the equality check of the returned Signal itself (Angular's default is used if omitted).

### `getItemByField(field, value, equalFn?)`

Returns a computed Signal containing the item whose field matches the given value. Type-safe — both the field name and value type are checked:

```ts
readonly product = collection.getItemByField('slug', 'my-product');

// With a reactive value
readonly slug = signal('my-product');
readonly product = collection.getItemByField('slug', this.slug);

// With multiple fields to check
readonly product = collection.getItemByField(['id', 'legacyId'], 42);
```

### `getItemByPartial(partItem, items?)`

Finds an item matching the partial, using the comparator. If `items` is omitted, searches `$items()`:

```ts
const product = collection.getItemByPartial({ id: 42 });
```

### `uniqueItems(items)`

Deduplicates an array using the comparator:

```ts
const unique = collection.uniqueItems([...listA, ...listB]);
```

## Next steps

- [Getting Started](getting-started.md) — setting up comparator fields
- [Error Handling](error-handling.md) — what happens when duplicates are detected
