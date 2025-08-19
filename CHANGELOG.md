## 5.0.2
The removal of the `sideEffect()` alias was not properly documented in the changelog - it was never declared as deprecated - so the alias has now been restored.

## 5.0.1
`createEffect()` with default options (with retry on errors allowed) was "swallowing" errors. Now the error will be printed to the console in dev mode, and the `onError()` callback will be called.

## 5.0.0
### Changes v4 -> v5:
* Angular v20 is now supported;
* The `readFrom` and `readManyFrom` methods are stable now and accept an `isReading` option in their parameters. You can pass a signal here, and when its value is truthy, the collection’s `$isReading()` will also return `true`. This can be useful to synchronize not only the values but also their reading (loading) state.

#### createEffect() changes:
* Support Promise as input value;
* The generator callback now has the second argument, `callbacks`. It contains an object with callbacks `success` and `error` - the observable you provide to `createEffect()` can use them to notify the effect caller;
* The second argument of `createEffect()` got new fields:
* * `onSuccess?: (v?: unknown) => void` - will be called when `callbacks.success` is called;
* * `onError?: (v?: unknown) => void` - will be called when `callbacks.error` is called;
* * `onFinalize?: () => void` - will be called when either `callbacks.success` or `callbacks.error` is called;
* When a signal is passed to the function created by `createEffect()`, the effect handler is called synchronously and will not be called again with the same value (equal by reference, `===`) when the underlying `effect()` is executed.

#### BREAKING CHANGES:
* `createEffect.getEffectFor()` renamed to `createEffect.asObservable()`;
* `createEffect.next$` is removed;
* `createEffect.error$` is removed.

## 5.0.0-rc.10
The `readFrom` and `readManyFrom` methods are stable now and accept an `isReading` option in their parameters.  
You can pass a signal here, and when its value is truthy, the collection’s `$isReading()` will also return `true`.  
This can be useful to synchronize not only the values but also their reading (loading) state.

## 5.0.0-rc.9
`createEffect()`: When a signal is passed, the first value received by the observable will be skipped only if it's equal (`===`) to the initial value of the signal.

## 5.0.0-rc.7
`createEffect()`: Avoid usage of exposed, but non-public APIs of Angular Signals.

## 5.0.0-rc.6
`createEffect()`: Support Promise as input value.

## 5.0.0-rc.5
`createEffect()`: Do not emit the first value of a signal with unset value (`input.required()`).

## 5.0.0-rc.4
When a signal is passed to the function created by `createEffect()`, the effect handler is called synchronously and will not be called again with the same value when the underlying `effect()` is executed.  
Previously, a change made in 5.0.0-rc.3 was causing one extra call with the same value.

## 5.0.0-rc.3
Because signals always have a value, when a signal is passed to the effect created by `createEffect()`, its initial value will now be emitted to the effect handler function.  
Previously, the initial value was only emitted during `effect()` execution.

## 5.0.0-rc.2
* Angular v20 is now supported;
* The generator callback now has the second argument, `callbacks`. It contains an object with callbacks `success` and `error` - the observable you provide to `createEffect()` can use them to notify the effect caller;
* The second argument of `createEffect()` got new fields:
* * `onSuccess?: (v?: unknown) => void` - will be called when `callbacks.success` is called;
* * `onError?: (v?: unknown) => void` - will be called when `callbacks.error` is called;
* * `onFinalize?: () => void` - will be called when either `callbacks.success` or `callbacks.error` is called;

### BREAKING CHANGES
* `createEffect.getEffectFor()` renamed to `createEffect.asObservable()`;
* `createEffect.next$` is removed;
* `createEffect.error$` is removed.

## 4.3.2
Add Angular v19 to the list of supported versions in dependencies.

## 4.3.1  
Callbacks `onSuccess()` and `onError()` were called before `$items` was updated. `$items()` inside the callbacks had a non-updated value.

## 4.3.0
New fields:
* `$lastReadError`
* `$lastReadOneError`
* `$lastReadManyError`
* `$lastRefreshError`  

In params structures, fields `readRequest` and `refreshRequest` are deprecated (will be removed in v5).  
Use `read` and `refresh` instead.


## 4.2.3
New method: `fetchItem()`!  

This method will check if the item exists in the collection and return it if it does.  
If the item does not exist, the `request` argument will be used to fetch the item and add it to the collection.  
If the option `fetchItemRequestFactory` is set, the `request` argument is optional.  
If both are missing, the resulting Observable will throw an error.

## 4.2.2
`createEffect.forValue()` renamed to `getEffectFor()`.

## 4.2.1
Experimental method for `createEffect()`: `forValue()`, which takes a value and returns an observable that will execute the effect when subscribed.

## 4.2.0
* New (experimental!) methods: `readFrom` and `readManyFrom`. Can be called as part of constructor options.
* `EffectFnMethods` renamed to `EffectObservables`, and lost methods `next`, `error` and `complete` - the same functionality with a less ambiguous API can be achieved with `EffectListeners`. This API is considered stable now.

## 4.1.3
* Use `untracked()` every time when reactive context should not be affected;
* Use `take(1)` instead of `first()` to prevent `no elements in sequence` exception.

## 4.1.2
Improved API for `createEffect()` listeners, introduced in v4.1.1.    

Methods of the function, returned by `createEffect()`:
```ts
export type EffectFnMethods = {
  next: (fn: ((v: unknown) => void)) => void,
  error: (fn: ((v: unknown) => void)) => void,
  complete: (fn: (() => void)) => void,
  next$: Observable<unknown>,
  error$: Observable<unknown>,
};
```

Also, you can set `next` listener or an object with listeners as a second argument, when you call an effect:
```ts
class Component {
  store = inject(Store);
  dialog = inject(Dialog);
  toasts = inject(Toasts);
  
  changeZipCode(zipCode: string) {
    this.store.changeZipCode(zipCode, () => this.dialog.close());
    
    // or:
    this.store.changeZipCode(zipCode, {
      next: () => this.dialog.close(),
      error: () => this.toasts.error('Error, please try again.'),
    });
  }
}
```

## 4.1.1
`createEffect()` now returns not just a function, but a function with methods! :)
API is experimental and might change,  so it's documented only here for now.

In your store:  

```ts
import { createEffect } from './create-effect';

class Store extends Collection<Item> {
  readonly changeZipCode = createEffect<string>(_ => _.pipe(
    // code to change zipcode
  ));
}
```

In your component:  

```ts
class Component {
  store = inject(Store);
  dialog = inject(Dialog);
  
  changeZipCode(zipCode: string) {
    this.store.changeZipCode.nextValue(() => this.dialog.close());
    this.store.changeZipCode(zipCode);
  }
}
```

In this example, the dialog window will be closed only *after* the service response, and only if it was successful.

Alongside nextValue, there are other methods:
```ts
export type EffectFnMethods = {
  nextValue: (fn: ((v: unknown) => void)) => void,
  nextError: (fn: ((v: unknown) => void)) => void,
  onNextValue(): Observable<unknown>,
  onNextError(): Observable<unknown>,
};
```

Internally, values and errors will not be saved in memory if you don't use these methods.

## 4.1.0
Sometimes we know in advance the IDs of items we read, and it can be quite useful to know that these items are being read.

Now, the methods `read()`, `readOne()`, and `readMany()` accept a parameter `item`/`items`, where you can pass partial items:

```ts
coll.read({
  request: req,
  items: [{id: 1}, {id: 2}]
});
```

This will instantly add `{id: 1}` and `{id: 2}` to `$readingItems`, but not to `$items` (because they are not in the collection yet).

Params should be objects that have *at least* the ID field (the field or multiple fields that the comparator will use to find the item). The object can also have any other fields - they will be ignored.

A new method, `isItemReading()`, will return a `Signal<boolean>` - you can check (reactively) if an item with a specific ID is being read.

The method `isItemProcessing()` will now also look for an item in `$readingItems` (in addition to previous states).

And a new helper method to quickly convert an array of IDs into partial items:     
`idsToPartialItems(ids: unknown[], field: string): Partial<T>[]`

## 4.0.7
Angular v18 is now supported.

## 4.0.6
* Function, returned by `createEffect()` now accepts `Signal<T> | WritableSignal<T>` as an argument;
* `createEffect()` now has optional configuration argument of type `CreateEffectOptions`. Here you can pass an injector, configure if function should retry on error (true by default), and pass `retry()` configuration options. All fields are optional.

## 4.0.5
Because of [PR#53446](https://github.com/angular/angular/pull/53446), one custom equality check function is restored. You can import it as `equalPrimitives()`.

## 4.0.0
* Angular v17.1.0-next is supported;
* Minimum supported version of Angular is v17.0.0 (stable).

### BREAKING CHANGES
* Status pipes removed: it's quite easy to read status from the collection directly in the template;
* Custom equality functions for Angular Signals removed: this library only operates on immutable data structures, and was using these functions only to guarantee updates even when items were mutated outside. In Angular v17 custom equality functions are [ignored for mutable structures](https://github.com/angular/angular/pull/52465/files), so they are useless even as a tool for other parts of your application;
* `getTrackByFieldFn()` helper is removed: with Angular v17 built-in control flow, it is not needed anymore;
* `setAfterFirstReadHandler()` is removed: use `setOnFirstItemsRequest()`.

### Fixes
* `$updatingItems`, `$deletingItems`, `$refreshingItems`, `$mutatingItems`, `$processingItems` will only contain items that currently exist in the `$items` list. Previously, they could potentially contain non-existing items for a short time. For example, if `read()` or `delete()` operations were executed faster than `update()`, and `update()` was started earlier, than `update()` would contain items that were removed by `delete()`, until its (`update()`) request is not completed. It was quite difficult to achieve (and even more difficult to notice), but now it's fixed;
* `$mutatingItems` and `$processingItems` now contain unique items only. Previously, it was theoretically possible to have duplicates there if some items were being removed and updated simultaneously.

## 3.4.3
Method `getItemByField()` now accepts `Signal<T|undefined>` as `fieldValue`.

## 3.4.2
* Method `setAfterFirstReadHandler()` renamed to `setOnFirstItemsRequest()`. Previous method is not removed, but deprecated.
* Now it's possible to set onFirstItemsRequest in the constructor (using the options object).

## 3.4.1
Fix: `getItem()` and `getItemByField()` should trigger lazy-loading. 

## 3.4.0

### Lazy loading!  

Previously, you could load the first set of items into the collection when collection is initialized, or when your service/component decide to do it.  

Now, you can also use lazy loading, using the `setAfterFirstReadHandler(handlerFn)` - `handlerFn` will be called once (asynchronously), when `$items` signal is read for the first time.  

Example:  

```ts
class ExampleService {
  private readonly coll = new Collection();
  private readonly api = inject(ApiService);

  private readonly load = createEffect(_ => _.pipe(
    switchMap(() => this.coll.read({
      request: this.api.getItems()
    }))
  ));

  constructor() {
    this.coll.setAfterFirstReadHandler(() => this.load());
  }
}
```

It is just an example - it's up to you how your handler will load the first set of items.

## 3.3.2
As preparation for [this change](https://github.com/angular/angular/commit/c7ff9dff2c14aba70e92b9e216a2d4d97d6ef71e) in Angular Signals, `collection.$items` now uses the first version of Angular Signals' default equality function. This function will always treat items as non-equal, so the `$items` signal will send a notification even if items still point to the same objects after the collection was mutated. This library treats items as immutable structures and will not compare them.

## 3.3.1
Allow `getItem()` to accept `undefined` as input (return type has not been changed).  

## 3.3.0
Workaround for Angular Signals [issue #51812](https://github.com/angular/angular/issues/51812).  

## 3.2.0
* New state field: `$isBeforeFirstRead: Signal<boolean>`.    
Initialized with 'true', will be set to `false` after  the first execution of `read()`, `readOne()`, or `readMany()`.  
  It is designed to be used with 'No entries found' placeholders.
* `effect()` helper was renamed to `createEffect()` to don't conflict with Angular's `effect()` function.  
  `createEffect()` is still exported as `effect()` for backwards compatibility, and as `sideEffect()` to don't conflict with NgRx.Store's `createEffect()`.

## 3.1.7
`effect()` helper will now resubscribe on errors, so if you forgot to catch an error - it's not an issue anymore.  
Also, if a value, passed to the effect, is an observable, and this observable throws an error, observable will be resubscribed automatically. 

## 3.1.6
`getItem()` and `getItemByField()` now accept `equalFn` parameter - you can set your own equality check function or set `undefined` to use the default one.

## 3.1.5
* Specialized equality check functions will be used in `getItem()` and `getItemByField()`. 
* Better documentation and more tests for equality check functions.

## 3.1.2 - 3.1.4
* Only update status$ signals when needed.
* `signalEqual` object is exposed as public API - here you can find functions to use for custom equality checks.

## 3.1.1
Better equality functions for signals.

## 3.1.0
* New method to replace previously removed `postInit()`: `asyncInit()`. Will be called in the next microtask from the constructor (`init()` will be called first).
* `Collection.constructor()` will complain in dev mode, if the comparator has to use default id fields, because no custom id fields are provided and no custom comparator is provided - that's exactly why `Collection` is not `@Injectable` anymore: providing this information is critically important for the correct functioning of `Collection`, so comparator fields (or a custom comparator) should be set explicitly. This error will help you not forget about it but will not pollute the console in production mode.

## 3.0.1
New helper: `effect()` function.  
Copy of `effect()` method of NgRx ComponentStore, where `takeUntil(this.destroy$)` is replaced with `takeUntilDestroyed(destroyRef)`, to use it as a function.

## 3.0.0
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

## 2.3.2
`getItemByPartial()` is now part of the API.

## 2.3.1
* Signal-based collection: `processingItems: Signal<T[]>` field has been added;
* Observable-based collection: `processingItems$: Observable<T[]>`, `processingItemsSignal: Signal<T[]>` fields have been added. 

## 2.3.0
* New methods, for both versions: `listenForItemsUpdate()`, `listenForItemsDeletion()`;
* Methods `isItemDeleting()`, `isItemRefreshing()`, `isItemUpdating()`, `isItemMutating()`, `isItemProcessing()` now accept `Partial<T>` as an argument...;
* ...and implemented in the observable-based version. They return signals there as well to have the same API. To get the same result using observables only, you can use `hasItemIn()` method.

## 2.2.1
Signal-based version (class `Collection`) now uses `NGX_COLLECTION_OPTIONS` injection token to inject options, because string injection tokens are deprecated in Angular.

## 2.2.0
* Signal-based [Collection](projects/ngx-collection/src/lib/collection.ts)!
* API documentation moved to the interfaces.

## 2.1.2
* `toObservable()` from '@angular/core/rxjs-interop' will be used without replacement;
* If instantiated not in an injection context and without `injector` argument, the `constructor()` will throw an error in development mode or will print to `console.error` (or `errorReporter`, if set), at runtime.

## 2.1.1
If class is instantiated in an injection context, the `injector` will be created from this context.

## 2.1.0
* Every `request` parameter now accepts signals! The signal will be read once, at the moment of request execution;
* Signals are accepted also by:
* * `getItemViewModel()`
* * `getItem()`
* * `getItemByField()`

## 2.0.0
* Add support for Angular Signals;
* This version requires Angular 16;
* Export `ViewModel` and `ItemViewModel` types;
* Every `interface` is converted to a `type`, so they can now be imported using `import type`.

## 1.4.1
Accept Angular 16 as peerDependency.

## 1.4.0
* `delete()` and `deleteMany()` now have 2 new optional fields in their params:
  * `readRequest`: consecutive `read()` request (will completely reset `items`);
  * `decrementTotalCount`: decrement `totalCountFetched` by count of removed items, by number, or read new value from the response object.
* Angular and NgRx versions bump, RxJS 7 & 8 versions are supported.

## 1.3.0
You can now get an observable to be notified about the mutations:
* `listenForCreate()`
* `listenForRead()`
* `listenForUpdate()`
* `listenForDelete()`
Events will be only emitted if there are active observers.

## 1.2.9

* Comparator now accepts dot-separated paths;
* onSuccess/onError callbacks are wrapped with `try...catch` now (will try to use `errReporter` in case of exception);
* errReporter is wrapped with `try...catch` now (in case of exception raised by `errReporter`, will try to use `console.error`, if exist).

## 1.2.8
* User `errReporter` to report errors, and don't use `console` by default.
* `Comparator` class (and `comparatorFields` parameter) now understand composite fields.
* Update NgRx dependencies to v15 (stable).

## 1.2.7
* Restore global configuration feature (`COLLECTION_SERVICE_OPTIONS` token)

## 1.2.5
* Make constructors empty (for some reason Angular complains that constructors with arguments are not compatible with dependency injection, although it only happens if code is published to npm).
* make `setOptions()` public.

## 1.2.1
* Optimize speed of duplicate detection in `read()`
* Add `"emitDecoratorMetadata": true` to tsconfig

## 1.2.0
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
