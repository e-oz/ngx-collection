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
