# createEffect

`createEffect()` is a standalone function for managing side effects with automatic lifecycle cleanup. It is adapted from NgRx ComponentStore's `effect()` method, with Angular's `DestroyRef` used for automatic teardown.

It is **not** a method of `Collection` — it's a standalone function exported from `ngx-collection`.

```ts
import { createEffect } from 'ngx-collection';
```

## Basic usage

`createEffect()` wraps an RxJS operator pipeline and provides a callable function that feeds values into it:

```ts
@Component({ /* ... */ })
export class ProductsComponent {
  private readonly http = inject(HttpClient);
  private readonly collection = inject(ProductsCollection);

  readonly loadProducts = createEffect<void>(_ => _.pipe(
    switchMap(() => this.collection.read({
      request: this.http.get<Product[]>('/api/products'),
      onError: (err) => this.toast.error('Load failed'),
    }))
  ));

  constructor() {
    this.loadProducts();
  }
}
```

The effect:
- Automatically unsubscribes when the component is destroyed (via `DestroyRef`).
- Stays alive after errors by default (see [Error recovery](#error-recovery)).
- Can be called multiple times — each call feeds a new value into the pipeline.

## Accepting values

The type parameter controls what the effect accepts:

```ts
readonly saveProduct = createEffect<Product>(_ => _.pipe(
  switchMap((product) => this.collection.update({
    request: this.http.put<Product>(`/api/products/${product.id}`, product),
    item: product,
  }))
));

// Call it with a value:
this.saveProduct(product);
```

## Accepting Observables and Signals

You can pass an Observable or Signal as the value source. The effect will react to each emission:

```ts
readonly searchTerm = signal('');

readonly search = createEffect<string>(_ => _.pipe(
  debounceTime(300),
  switchMap((term) => this.collection.read({
    request: this.http.get<Product[]>(`/api/products?q=${term}`),
  }))
));

constructor() {
  // Feed the signal into the effect — reacts to every change
  this.search(this.searchTerm);
}
```

When a Signal is passed:
- Its current value is read and emitted immediately.
- Subsequent changes are emitted via Angular's `toObservable`.
- The initial value is not emitted twice.
- Angular's `input.required()` signals that haven't received a value yet are handled gracefully — no emission until a value is set.

## Callbacks

### Inline callbacks

The simplest form — pass a function as the second argument to receive the generator's emitted values:

```ts
this.saveProduct(product, (result) => {
  console.log('Pipeline emitted:', result);
});
```

### Structured callbacks

Pass an object with specific lifecycle hooks:

```ts
this.saveProduct(product, {
  next: (value) => { /* generator emitted a value */ },
  onSuccess: (value) => { /* callbacks.success() was called inside generator */ },
  error: (err) => { /* generator's subscription errored */ },
  onError: (err) => { /* callbacks.error() was called inside generator */ },
  complete: () => { /* generator's subscription completed */ },
  onFinalize: () => { /* callbacks.success() or callbacks.error() was called */ },
});
```

### Using the callbacks parameter in the generator

The generator function receives a `callbacks` object as its second argument. Call `callbacks.success()` or `callbacks.error()` to trigger the corresponding listeners:

```ts
readonly saveProduct = createEffect<Product>((product$, callbacks) => product$.pipe(
  switchMap((product) => this.collection.update({
    request: this.http.put<Product>(`/api/products/${product.id}`, product),
    item: product,
    onSuccess: (item) => callbacks.success(item),
    onError: (err) => callbacks.error(err),
  }))
));

// The caller can then react:
this.saveProduct(product, {
  onSuccess: (item) => this.toast.success('Saved!'),
  onError: (err) => this.toast.error('Failed'),
  onFinalize: () => this.isSubmitting.set(false),
});
```

This pattern cleanly separates the effect logic (how to save) from the caller's reaction (what to do after).

## Error recovery

By default, `retryOnError` is `true`. This means if the generator pipeline throws an unhandled error, the effect automatically resubscribes and keeps working. A single error doesn't kill the effect permanently — subsequent calls still work.

```ts
// Default: retryOnError is true
const save = createEffect<Product>(_ => _.pipe(
  switchMap((product) => this.http.put(`/api/products/${product.id}`, product))
));

save(product1); // Fails with a network error
save(product2); // Still works — the effect recovered
```

To disable this:

```ts
const save = createEffect<Product>(_ => _.pipe(
  switchMap((product) => this.http.put(`/api/products/${product.id}`, product))
), { retryOnError: false });

save(product1); // Fails — effect is now dead
save(product2); // Ignored
```

You can also pass a `RetryConfig` for fine-grained control:

```ts
const save = createEffect<Product>(_ => _.pipe(
  switchMap((product) => this.http.put(`/api/products/${product.id}`, product))
), { retryOnError: { count: 3, delay: 1000 } });
```

## `asObservable`

The `asObservable` property returns the raw Observable from the generator without subscribing. Use this when you want to manage the subscription yourself:

```ts
const save = createEffect<Product>(_ => _.pipe(
  switchMap((product) => this.http.put<Product>(`/api/products/${product.id}`, product))
));

// Get the Observable without subscribing
const save$ = save.asObservable(product);
// Now you can compose it with other Observables, pipe it, etc.
```

## Using outside injection context

By default, `createEffect()` must be called within an Angular injection context (e.g., a constructor or a field initializer). To use it elsewhere, provide an injector:

```ts
readonly save = createEffect<Product>(_ => _.pipe(
  switchMap((product) => this.http.put<Product>(`/api/products/${product.id}`, product))
), { injector: this.injector });
```

## Practical example with a collection

```ts
@Component({
  selector: 'app-products',
  standalone: true,
  providers: [ProductsCollection],
  template: `
    <input [ngModel]="search()" (ngModelChange)="search.set($event)" />

    @if (collection.$isReading()) {
      <app-spinner />
    }

    @for (product of collection.$items(); track product.id) {
      <app-product-card
        [product]="product"
        [saving]="collection.isItemUpdating(product)()"
        (save)="saveProduct($event)"
        (delete)="deleteProduct($event)"
      />
    }
  `
})
export class ProductsComponent {
  private readonly http = inject(HttpClient);
  protected readonly collection = inject(ProductsCollection);

  protected readonly search = signal('');

  private readonly loadProducts = createEffect<string>(_ => _.pipe(
    debounceTime(300),
    switchMap((query) => this.collection.read({
      request: this.http.get<Product[]>(`/api/products?q=${query}`),
    }))
  ));

  readonly saveProduct = createEffect<Product>((product$, callbacks) => product$.pipe(
    mergeMap((product) => this.collection.update({
      request: this.http.put<Product>(`/api/products/${product.id}`, product),
      item: product,
      onSuccess: () => callbacks.success(),
      onError: (err) => callbacks.error(err),
    }))
  ));

  readonly deleteProduct = createEffect<Product>(_ => _.pipe(
    exhaustMap((product) => this.collection.delete({
      request: this.http.delete(`/api/products/${product.id}`),
      item: product,
    }))
  ));

  constructor() {
    this.loadProducts(this.search);
  }
}
```

## Next steps

- [CRUD Operations](crud-operations.md) — the collection methods used inside effects
- [Core Concepts](core-concepts.md) — how the collection manages state
