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
* Add `deleteItemStatus` method

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
* Make all selectors in itemViewModel protected from streams without pre-emitted value;
* Add `getTrackByFieldFn()` helper function.

## 1.0.7
* read() now accepts usual arrays also;
* Info about duplicates prevention has been added to README.