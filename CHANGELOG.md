### 3.1.6
`getItem()` and `getItemByField()` now accept `equalFn` parameter - you can set your own equality check function or set `undefined` to use the default one.

### 3.1.5
* Specialized equality check functions will be used in `getItem()` and `getItemByField()`. 
* Better documentation and more tests for equality check functions.

### 3.1.2 - 3.1.4
* Only update status$ signals when needed.
* `signalEqual` object is exposed as public API - here you can find functions to use for custom equality checks.

### 3.1.1
Better equality functions for signals.

### 3.1.0
* New method to replace previously removed `postInit()`: `asyncInit()`. Will be called in the next microtask from the constructor (`init()` will be called first).
* `Collection.constructor()` will complain in dev mode, if the comparator has to use default id fields, because no custom id fields are provided and no custom comparator is provided - that's exactly why `Collection` is not `@Injectable` anymore: providing this information is critically important for the correct functioning of `Collection`, so comparator fields (or a custom comparator) should be set explicitly. This error will help you not forget about it but will not pollute the console in production mode.

### 3.0.1
New helper: `effect()` function.  
Copy of `effect()` method of NgRx ComponentStore, where `takeUntil(this.destroy$)` is replaced with `takeUntilDestroyed(destroyRef)`, to use it as a function.

### 3.0.0
Breaking changes:
* Observable-based version removed;
* `CollectionCore` renamed to `CollectionInterface`;
* Fields, containing signals now prefixed with '$' (`$items`, `$totalCountFetched`, `$isUpdating` and so on);
* Methods don't accept observables anymore:
* * `isItemDeleting()`
* * `isItemRefreshing()`
* * `isItemUpdating()`
* * `isItemMutating()`
* * `isItemProcessing()`
* `Collection` class is not `@Injectable` anymore. Easiest way to create an injectable class is to extend `Collection` with an `@Injectable` class;
* `NGX_COLLECTION_OPTIONS` token removed - set options using `constructor()` or `setOptions()`;
* Default value for `onDuplicateErrCallbackParam` changed from `{status: 409}` to `DuplicateError` object;
* `postInit()` method removed - you can declare your own and call it as `Promise.resolve().then(() => this.postInit());` from `init()` if needed;
* `CollectionManager` merged back to `Collection`.

### 2.3.2
`getItemByPartial()` is now part of the API.

### 2.3.1
* Signal-based collection: `processingItems: Signal<T[]>` field has been added;
* Observable-based collection: `processingItems$: Observable<T[]>`, `processingItemsSignal: Signal<T[]>` fields have been added. 

### 2.3.0
* New methods, for both versions: `listenForItemsUpdate()`, `listenForItemsDeletion()`;
* Methods `isItemDeleting()`, `isItemRefreshing()`, `isItemUpdating()`, `isItemMutating()`, `isItemProcessing()` now accept `Partial<T>` as an argument...;
* ...and implemented in the observable-based version. They return signals there as well to have the same API. To get the same result using observables only, you can use `hasItemIn()` method.

### 2.2.1
Signal-based version (class `Collection`) now uses `NGX_COLLECTION_OPTIONS` injection token to inject options, because string injection tokens are deprecated in Angular.

### 2.2.0
* Signal-based [Collection](projects/ngx-collection/src/lib/collection.ts)!
* API documentation moved to the interfaces.

### 2.1.2
* `toObservable()` from '@angular/core/rxjs-interop' will be used without replacement;
* If instantiated not in an injection context and without `injector` argument, the `constructor()` will throw an error in development mode or will print to `console.error` (or `errorReporter`, if set), at runtime.

### 2.1.1
If class is instantiated in an injection context, the `injector` will be created from this context.

### 2.1.0
* Every `request` parameter now accepts signals! The signal will be read once, at the moment of request execution;
* Signals are accepted also by:
* * `getItemViewModel()`
* * `getItem()`
* * `getItemByField()`

### 2.0.0
* Add support for Angular Signals;
* This version requires Angular 16;
* Export `ViewModel` and `ItemViewModel` types;
* Every `interface` is converted to a `type`, so they can now be imported using `import type`.

### 1.4.1
Accept Angular 16 as peerDependency.

### 1.4.0
* `delete()` and `deleteMany()` now have 2 new optional fields in their params:
  * `readRequest`: consecutive `read()` request (will completely reset `items`);
  * `decrementTotalCount`: decrement `totalCountFetched` by count of removed items, by number, or read new value from the response object.
* Angular and NgRx versions bump, RxJS 7 & 8 versions are supported.

### 1.3.0
You can now get an observable to be notified about the mutations:
* `listenForCreate()`
* `listenForRead()`
* `listenForUpdate()`
* `listenForDelete()`
Events will be only emitted if there are active observers.

### 1.2.9

* Comparator now accepts dot-separated paths;
* onSuccess/onError callbacks are wrapped with `try...catch` now (will try to use `errReporter` in case of exception);
* errReporter is wrapped with `try...catch` now (in case of exception raised by `errReporter`, will try to use `console.error`, if exist).

### 1.2.8
* User `errReporter` to report errors, and don't use `console` by default.
* `Comparator` class (and `comparatorFields` parameter) now understand composite fields.
* Update NgRx dependencies to v15 (stable).

### 1.2.7
* Restore global configuration feature (`COLLECTION_SERVICE_OPTIONS` token)

### 1.2.5
* Make constructors empty (for some reason Angular complains that constructors with arguments are not compatible with dependency injection, although it only happens if code is published to npm).
* make `setOptions()` public.

### 1.2.1
* Optimize speed of duplicate detection in `read()`
* Add `"emitDecoratorMetadata": true` to tsconfig

### 1.2.0
* New (additional) methods: 
  * `createMany()`
  * `refreshMany()`
  * `updateMany()`
  * `deleteMany()`
* `request` parameter will now accept an array of requests (to `forkJoin()` them) in:
  * `createMany()`
  * `readMany()`
  * `refreshMany()`
  * `updateMany()`
  * `deleteMany()`  
  Requests with suffix `*many` will run in parallel (using `forkJoin()`). If you need to run them differently, you can use regular methods with the [creation operator](https://rxjs.dev/guide/operators#creation-operators-1) of your choice.
* A function can be used as a value for the `comparator` field in configuration options or as an argument for `setComparator()` method;
* New method for override: `postInit()` - will be called in the next microtask after `constructor()`.   
  You can override and use it to call the methods declared in the subclass and still don't bother about `constructor()` overriding;
* `getTrackByFieldFn()` helper will not use fields with empty values;
* Jest has been configured to run tests in this repo - pull requests are welcome!

## 1.1.1
* `readMany()` should update `totalCountFetched` if provided

## 1.1.0
* `onDuplicateErrCallbackParam` added to configuration options.
* type restriction for `item` parameter is relaxed to Partial<T>. It was possible to use partial objects before, but it was not obvious from signatures.
* New methods `readOne()`, `readMany()`, `getItem()`, `getItemByField()` have been added and documented.
* Removed synchronous check from `setUniqueStatus()` when `active = false`. It was the only synchronous call in code.  

## 1.0.10
* Update dependencies to Angular 15 release version
* Add file with test to the repo
* Add `deleteItemStatus()` method

## 1.0.9
You can (optionally) declare Collection Service configuration details in your module or component providers:
```ts
providers: [
  {
    provide: 'COLLECTION_SERVICE_OPTIONS',
    useValue: {
      allowFetchedDuplicates: environment.production,
    }
  },
]
```
Token `COLLECTION_SERVICE_OPTIONS` is just a string to don't break lazy-loading (if you are using it).

Options structure:
```ts
interface CollectionServiceOptions {
  comparatorFields?: string[];
  throwOnDuplicates?: string;
  allowFetchedDuplicates?: boolean; // if not set: true
}
```

## 1.0.8
* Fix itemViewModel.isProcessing; 
* Make all selectors in `itemViewModel` protected from streams without pre-emitted value;
* Add `getTrackByFieldFn()` helper function.

## 1.0.7
* `read()` now accepts usual arrays also;
* Info about duplicates prevention has been added to README.
