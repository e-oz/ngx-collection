Collection
==========
<p align="center"><img src="./ngx-collection-shield.svg" height="300px"></p>
<p align="center">Collection State Management Service</p>

# Introduction

By using this service, you can easily and safely mutate collections of items and monitor their state (as well as the state of their mutations).

All the actions are asynchronous and immutable - items and collections will not be modified: new items and new collections will be created on every mutation.

To monitor the state, you can use one of the predefined selectors or a view model.

Out of the box, without any additional code, you'll be able to control your "loading" spinners, temporarily disable buttons, display success/error messages, and much more.

This service is built on top of [NgRx ComponentStore](https://ngrx.io/guide/component-store), all selectors (including view models) are generated using `ComponentStore.select()` method.

# Example Application

You can read an [introductory article](https://medium.com/@eugeniyoz/collection-service-for-angular-d0b64bae9c20) that includes an example of building this application.     

## 🖼️ [StackBlitz](https://stackblitz.com/edit/ngx-collection-example?file=src%2Fapp%2Fcollections%2Fpaintings.collection.ts)  

Here you can see how little code you need to gently manipulate your collection of art! 

# Benefits
✅  Every mutation is asynchronous:  
* works in reactive apps with the OnPush change detection strategy;  
* works in components with the Default change detection strategy;  
* can be used with just the `async` pipe and `subscribe()`, or with some store;
* built-in support for Angular Signals.

✅  The service is not opinionated:  
* it will not dictate how you should communicate with your APIs or other data sources;    
* you decide how to run and cancel your requests. Every mutation method returns an observable, so you can decide how to orchestrate them using methods like switchMap, mergeMap, concatMap, forkJoin, or something else;  
* Data sources can be synchronous (you can use rxjs/of for this purpose).  

✅  Safety guarantees:
* 100% immutability;  
* Duplicates prevention;  
* Errors and exceptions will be handled correctly;   
* Strictly typed — advanced type-checking and code completion.

# Installation

Requires Angular 16, and [NgRx ComponentStore](https://ngrx.io/guide/component-store) 15  

[Yarn](https://yarnpkg.com/package/ngx-collection): 
```
yarn add ngx-collection
```  

[NPM](https://www.npmjs.com/package/ngx-collection): 
```
npm i ngx-collection
```

In your code:

```ts
import { CollectionService } from 'ngx-collection';
```

# Usage
This service is designed to be used in 2 ways:  

1. Local collection - a temporary instance with a lifecycle bound to a component;
2. Shared collection - a global singleton.

## Examples

While it is possible to use this service directly in your component, it is good practice to move all the state management out of a component and into a "store".   
Therefore, examples will rely on usage with [ComponentStore](https://ngrx.io/guide/component-store).

### Local collection
A local collection will be destroyed with its associated component.

#### In your Component:
To use a local collection instance, you need to add it to the "providers" array of your component (or module):
```ts
@Component({
  selector: 'example',
  standalone: true,
  ///...
  providers: [
    ExampleStore, 
    CollectionService
  ],
})
export class ExampleComponent {
  
  // Usage of `inject()` is required here (to make the CollectionService instance accessible in the ExampleStore).
  // Declare it before usage of the "store" field.
  protected readonly store = inject(ExampleStore);

  // you can now use the "store" field.
  protected readonly vm$ = this.store.examplesCollection.getViewModel();

}
```

#### In your Component Store:

```ts
export class ExampleStore extends ComponentStore<ExampleState> {
  readonly examplesCollection = inject(CollectionService<Example>);
}
```

### Shared collection

If you want to share a collection of items between multiple components, you can create a shared collection.  

One example use case is having a list of items (ListComponent), and every item is rendered using a component (ListItemComponent). 
If both ListComponent and ListItemComponent use the same shared collection, changes made to one of them will be instantly reflected in the other.  

To create a shared collection, create a new class that extends this service and add the `@Injectable({providedIn: 'root'})` decorator:
```ts
@Injectable({providedIn: 'root'})
export class BooksCollectionService extends CollectionService<Book> {
  // to use a global instance, do not add this service to the "providers" array 
  // otherwise, a new (local) instance will be injected.
  
  constructor() {
    // at least an empty constructor should be created to make class compatible with Angular Dependency Injection
    super();
  }  
}
```
For your convenience, there is a protected `init()` method that you can override if you want some special initialization logic, so you don't have to deal with overriding the `constructor()` method.

#### In your Component:

```ts
@Component({
  selector: 'book',
  standalone: true,
  ///...
  providers: [BookStore], // BooksCollectionService should not be added here
})
export class BookComponent {
  protected readonly store = inject(BookStore);
  protected readonly vm$ = this.store.booksCollection.getViewModel();
}
```

#### In your Component Store:

```ts
export class BookStore extends ComponentStore<BookStoreState> {
  readonly booksCollection = inject(BooksCollectionService);
}
```


### View Model

The simplest way to watch the state of a collection is to use `collection.getViewModel() | async` in your template.

The ViewModel contains a lot of useful fields:

* `items$`[]
* `isCreating$`
* `isReading$`
* `isUpdating$`
* `isDeleting$`
* `isMutating$`
* `isSaving$`
* `updatingItems$`[]
* `deletingItems$`[]

and some others.


Alternatively, you can use `collection.state$` or any other public field and method of the Collection Service class.

If your component is rendering one of the collection's items, you can use `getItemViewModel()` method to monitor the state changes of your item.  

Item's view model is more simple:  

* `isDeleting$`
* `isRefreshing$`
* `isUpdating$`
* `isMutating$`
* `isProcessing$`

In both models, `mutating` = (`updating` OR `deleting`).

### Mutations

The Collection Service has four main methods to mutate a collection: `create()`, `read()`, `update()`, `delete()`.  

#### Create
Call `create` to add a new item to a collection:

```ts
this.booksCollection.create({
  request: this.booksService.saveBook(bookData),
  onSuccess: () => this.messageService.success('Created'),
  onError: () => this.messageService.error('Error'),
})
```

#### Read
`read()` will load the list of items: 
```ts
this.booksCollection.read({
    request: this.booksService.getBooks(),
    onError: () => this.messageService.error('Can not load the list of books')
  })
```

#### Update
Use `update()` to modify some particular item in your collection:
```ts
this.booksCollection.update({
  request: this.booksService.saveBook(bookData),
  item: bookItem,
  onSuccess: () => this.messageService.success('Saved'),
  onError: () => this.messageService.error('Error'),
})
```

#### Delete
The usage of `delete()` is obvious. Let's explore a more detailed example:
```ts
export class BookStore extends ComponentStore<BookStoreState> {

  public readonly remove = this.effect<Book>(_ => _.pipe(
    exhaustMap((book) => {
      if (!book) {
        return EMPTY;
      }
      return openModalConfirm({
        title: 'Book Removal',
        question: 'Do you want to delete this book?',
      }).afterClosed().pipe(
        exhaustMap((result) => {
          if (result) {
            return this.booksCollection.delete({
              request: book.uuId ? this.booksService.removeBook(book.uuId) : of(null),
              item: book,
              onSuccess: () => this.messageService.success('Removed'),
              onError: () => this.messageService.error('Error'),
            });
          }
          return EMPTY;
        })
      );
    })
  ));
}
```

## Statuses
You can set statuses for the items. Statuses can be unique per collection (for example: 'focused') or not (for example: 'selected'). 
Statuses are not predefined; you can use your list of statuses. The service only needs to know if a given status is unique or not unique.

## Items comparison
The equality of items will be checked using the comparator, which you can replace using the `setComparator()` method.

The comparator will first compare items using `===`, then it will use id fields.

You can check the default id fields list of the default comparator in the [comparator.ts](projects/ngx-collection/src/lib/comparator.ts) file.

You can easily configure this using Angular DI:
```ts
    {
      provide: 'COLLECTION_SERVICE_OPTIONS',
      useValue: {
        comparatorFields: ['uuId', 'url'],
      }
    },
```

or in constructor:

```ts
const collection = new CollectionService<Item>({comparatorFields: ['uuId', 'url']}, this.injector);
```

or using `setOptions()`, or by re-instantiating a Comparator:

```ts
export class NotificationsCollectionService extends CollectionService<Notification> {
  override init() {
    this.setOptions({comparatorFields: ['uuId', 'url']});
    
    // another way:
    this.setComparator(new Comparator(['signature']))
  }
}
```

or by providing your own Comparator - it can be a class, implementing `ObjectsComparator` interface, or a function, implementing `ObjectsComparatorFn`.

## Comparator fields

In the default comparator, each item in the list of fields can be:  
1. `string` - if both objects have this field, and values are equal, the objects are considered equal.   
   If both objects have this field, but the values are not equal, the objects are not equal and __the comparison stops__.  
2. `string[]` - composite field: If both objects have every field listed, and every value is equal, the objects are considered equal.

Every field in the list will be treated as path, if it has a dot in it - this way you can compare nested fields.

## Duplicates prevention

The Collection Service will not allow duplicates in the collection.   

Items will be checked before adding to the collection in the `create()`, `read()`, `update()`, and `refresh()` methods.

To find a duplicate, items will be compared by using the comparator. Object equality check is a vital part of this service, and duplicates will break this functionality.    

A collection might have duplicates due to some data error or because of incorrect fields in the comparator. You can redefine them to fix this issue.  

If a duplicate is detected, the item will not be added to the collection, and an error will be sent to the `errReporter` (if `errReporter` is set).   
You can call `setThrowOnDuplicates('some message')` to make the Collection Service throw an exception with the message you expect.

The `read()` method, by default, will put returned items to the collection even if they have duplicates, but the `errReporter` will be called (if `errReporter` is set) because in this case, you have a chance to damage your data in future `update()` operations.   
You can call `setAllowFetchedDuplicates(false)` to instruct `read()` not to accept items lists with duplicates.

## Request parameters

### request

In every params object, `request` is an observable or signal that you are using to send the request to the API.  
Only the first emitted value will be used.  
If the request is a signal, the signal will be read once at the moment of request execution.  
The same rule applies to arrays of observables and signals, as some methods accept them too.

```ts
  return this.exampleCollection.update({
    request: this.exampleService.saveExample(data),
    item: exampleItem,
    onSuccess: () => this.messageService.success('Saved'),
    onError: () => this.messageService.error('Error'),
  });
```

### item

The `item` parameter is the item that you are mutating.  
You receive this item from the items field of the collection state.

```ts
  remove = this.effect<Example>(_ => _.pipe(
    exhaustMap((example) => {
      return this.examplesCollection.delete({
        request: example.uuId ? this.exampleService.removeExample(example.uuId) : signal(null),
        item: example,
        onSuccess: () => this.messageService.success('Removed'),
        onError: () => this.messageService.error('Error'),
      });
    })
  ));
```

You can send just a part of the item object, but this part should contain at least one of the comparator's fields (id fields).  
See "Items comparison" for details.

```ts
  remove = this.effect<string>(_ => _.pipe(
    exhaustMap((uuId) => {
      return this.examplesCollection.delete({
        request: uuId ? this.exampleService.removeExample(uuId) : signal(null),
        item: {uuId: uuId},
        onSuccess: () => this.messageService.success('Removed'),
        onError: () => this.messageService.error('Error'),
      });
    })
  ));
```

# Pipes

This library provides two Angular pipes to make it easier to use collection statuses:  

* [UniqueStatusPipe](projects/ngx-collection/src/lib/status.pipes.ts)
* [StatusesPipe](projects/ngx-collection/src/lib/status.pipes.ts)

# Interface `FetchedItems<T>`

The `read()` method additionally supports a specific type from the request execution result, not just a list of items but a wrapper containing a list of items: `FetchedItems` type.   

You can (optionally) use this or a similar structure to don't lose meta information, such as the total count of items (usually needed for pagination).

# Global configuration
You can (optionally) declare Collection Service configuration details in your module or component providers:
```ts
providers: [
  {
    provide: 'COLLECTION_SERVICE_OPTIONS',
    useValue: {
      allowFetchedDuplicates: environment.production,
      errReporter: environment.production ? undefined : console.error
    }
  },
]
```
Token `COLLECTION_SERVICE_OPTIONS` is just a string to don't break lazy-loading (if you are using it).

Options structure:
```ts
interface CollectionServiceOptions {
  // List of "id" fields
  comparatorFields?: string[];

  // Custom comparator - will override `comparatorFields` if set
  comparator?: ObjectsComparator | ObjectsComparatorFn;
  
  // If set, duplicates detection will throw an exception with this value as an argument
  throwOnDuplicates?: string;
  
  // if not set: true
  allowFetchedDuplicates?: boolean;
  
  // in case of duplicate detection, `onError` callback function (if provided) will be called with this value as an argument
  onDuplicateErrCallbackParam?: any;

  // print errors. Example: ` errReporter: environment.production ? undefined : console.error `
  errReporter?: (...args: any[]) => any;
}
```

---


# API
The API has a lot of fields and methods, but you don't have to learn and use all of them. Just use the fields and methods that your application needs.

## Main methods

### create()
Add a new item to the collection.  
#### Parameters object
```ts
interface CreateParams<T> {
  request: Observable<T> | Signal<T>;
  onSuccess?: (item: T) => void;
  onError?: (error: unknown) => void;
}
```

---

### read()
Create a new collection from provided items.  
#### Parameters object
```ts
interface ReadParams<T> {
  request: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;
  onSuccess?: (items: T[]) => void;
  onError?: (error: unknown) => void;
  keepExistingOnError?: boolean;
}
```

---

### update()
This method replaces the existing item with the new one. If no existing item is found, a new one will be added.  

You can optionally set `refreshRequest` to provide an observable that will be used to get the new item:  
*  If `refreshRequest` is set, `request` returned item will be ignored (but the request itself will be sent), and the result of the `refreshRequest` will become a new value of an item.  
  Item will be removed from `updatingItems`, `mutatingItems` only after executing both requests - to prevent spinners from flickering.

#### Parameters object
```ts
interface UpdateParams<T> {
  request: Observable<T> | Signal<T>;
  refreshRequest?: Observable<T> | Signal<T>;
  item: T;
  onSuccess?: (item: T) => void;
  onError?: (error: unknown) => void;
}
```

---

### delete()
Remove an item from the collection.  
If `decrementTotalCount` is provided (and `readRequest` is not provided):  
* `boolean`: decrement `totalCountFetched` by 1 (if current totalCountFetched > 0);  
* `number`: decrement `totalCountFetched` by number (should be integer, less or equal to the current value of `totalCountFetched`);  
* `string`: points what field of the response object should be used (if exist) as a source of `totalCountFetched` (should be integer, >= 0).

If `readRequest` is provided, it will be the source of the new set of items (decrementTotalCount will be ignored).

#### Parameters object
```ts
interface DeleteParams<T, R = unknown> {
  request: Observable<R> | Signal<R>;
  item: T;
  decrementTotalCount?: boolean | number | string;
  readRequest?: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;
  onSuccess?: (response: R) => void;
  onError?: (error: unknown) => void;
}
```

## Additional Methods

### createMany()  
Like `create()`, but will run multiple requests in parallel.  
#### Parameters object
```ts
interface CreateManyParams<T> {
  request: Observable<FetchedItems<T> | T[]> | Observable<T>[] | Signal<FetchedItems<T> | T[]> | Signal<T>[];
  onSuccess?: (items: T[]) => void;
  onError?: (error: unknown) => void;
}
```

---

### readOne()
Read and update/add one item.   
Will toggle `isReading` state field of the collection.  
Designed to be used in components with no guarantee that the item is already fetched from the server (and, therefore, needs to fetch the item first).
#### Parameters object
```ts
interface ReadOneParams<T> {
  request: Observable<T> | Signal<T>;
  onSuccess?: (item: T) => void;
  onError?: (error: unknown) => void;
}
```

---

### readMany()
Read and add a set of items to the collection.   
Existing items will be updated.   
Will toggle `isReading` state field of the collection.
Designed to be used for pagination or infinite scroll.
#### Parameters object
```ts
interface ReadManyParams<T> {
  request: Observable<FetchedItems<T> | T[]> | Observable<T>[] | Signal<FetchedItems<T> | T[]> | Signal<T>[];
  onSuccess?: (items: T[]) => void;
  onError?: (error: unknown) => void;
}
```

---

### refresh()
Item will be updated without adding it to `updating` or `mutating` lists, and __without__ toggling `isReading` state field of the collection.         
Item will be added to the `refreshing` list, triggering modifications of related state fields.    
Designed to be used for "reloading" the item data without triggering "disabled" statuses of controls.  
#### Parameters object
```ts
interface RefreshParams<T> {
  request: Observable<T> | Signal<T>;
  item: T;
  onSuccess?: (item: T) => void;
  onError?: (error: unknown) => void;
}
```

---

### refreshMany()  
Like `refresh()`, but for multiple items. Requests will run in parallel.
#### Parameters object
```ts
interface RefreshManyParams<T> {
  request: Observable<FetchedItems<T> | T[]> | Observable<T>[] | Signal<FetchedItems<T> | T[]> | Signal<T>[];
  items: Partial<T>[];
  onSuccess?: (item: T[]) => void;
  onError?: (error: unknown) => void;
}
```

---

### updateMany()  
Like `update()`, but for multiple items. Requests will run in parallel.  
Consecutive `refreshRequest` (if set) will be executed using `refreshMany()`.  
#### Parameters object
```ts
interface UpdateManyParams<T> {
  request: Observable<T[]> | Observable<T>[] | Signal<T[]> | Signal<T>[];
  refreshRequest?: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;
  items: Partial<T>[];
  onSuccess?: (item: T[]) => void;
  onError?: (error: unknown) => void;
}
```

---

### deleteMany()  
Like `delete()`, but will run multiple queries in parallel.  
If `decrementTotalCount` is provided (and `readRequest` is not provided):  
* `boolean`: decrement `totalCountFetched` by number of removed items (if resulting `totalCountFetched` >= 0);  
* `number`: decrement `totalCountFetched` by number (should be integer, less or equal to the current value of `totalCountFetched`);  
* `string`: points what field of the response object (first one, if it's an array) should be used (if exist) as a source of `totalCountFetched` (should be integer, >= 0).

#### Parameters object
```ts
interface DeleteManyParams<T, R = unknown> {
  request: Observable<R> | Observable<R>[] | Signal<R> | Signal<R>[];
  items: Partial<T>[];
  readRequest?: Observable<FetchedItems<T> | T[]> | Signal<FetchedItems<T> | T[]>;
  onSuccess?: (response: R[]) => void;
  onError?: (error: unknown) => void;
}
```

---

### setUniqueStatus()
Set the status for an item.  
Only one item in the collection can have this status.  
Designed to be used with statuses like 'focused', 'expanded', and so on.  
#### Parameters
* `status` - any value (including objects, will be used as a key in a Map)
* `item`
* `active` - if the status is active for this particular item. `boolean`, optional, `true` by default. If set to `false`, __and__ this status currently is assigned to this item, then the status will be removed.

---

### deleteUniqueStatus()
Removes unique status.  
No items will be associated with this status after this call.
#### Parameters
* `status` - any value

---

### setItemStatus()
Set the status of the item.  
#### Parameters
* `item`
* `status` - can be anything.

---


### deleteItemStatus()
Removes the status of the item.  
#### Parameters
* `item`
* `status` - can be anything.

---

### getViewModel()
Get ViewModel dictionary of observables.
```ts
{
  items: T[],
  totalCountFetched: number | undefined,
  isCreating: boolean,
  isReading: boolean,
  isUpdating: boolean,
  isDeleting: boolean,
  isMutating: boolean,
  isSaving: boolean,
  isProcessing: boolean,
  updatingItems: T[],
  deletingItems: T[],
  mutatingItems: T[],
  refreshingItems: T[],
  statuses: Map<T, Status>,
  status: Map<UniqueStatus, T>,
}
```
Designed to be used with async pipe:
```angular2html
<ng-container *ngIf="viewModel$ | async as $">
  <spinner *ngIf="$.isReading"></spinner>
</ng-container>
```

---

### getItemViewModel()
Get ViewModel for an item.
#### Parameters
* `itemSource: Observable<T | undefined> | Signal<T | undefined>` 
#### Returns
Dictionary of observables:
```ts
{
  isDeleting: boolean,
  isRefreshing: boolean,
  isUpdating: boolean,
  isMutating: boolean,
  isProcessing: boolean,
}
```

---

### getItem()
Creates an item selector.  
#### Parameters
* `filter` - (partial) item to be compared with. Also accepts observables and signals.

---

### getItemByField()
Creates an item selector.  
#### Parameters
* `field` - one field or array of the fields, that item can have (type-checked).
* `fieldValue` - value (type-checked), also accepts observables and signals.

---

### setOptions()
Set multiple options at once. Useful during initialization.
#### Parameters object
```ts
interface CollectionServiceOptions {
  // List of "id" fields
  comparatorFields?: string[];

  // Custom comparator - will override `comparatorFields` if set
  comparator?: ObjectsComparator | ObjectsComparatorFn;

  // If set, duplicates detection will throw an exception with this value as an argument
  throwOnDuplicates?: string;

  // if not set: true
  allowFetchedDuplicates?: boolean;

  // in case of duplicate detection, `onError` callback function (if provided) will be called with this value as an argument
  onDuplicateErrCallbackParam?: any;

  // print errors. Example: ` errReporter: environment.production ? undefined : console.error `
  errReporter?: (...args: any[]) => any;
}
```

---

### listenForCreate()
Get an observable to be notified when new items are created.
#### Returns
Observable<T[]> - items that were returned by the `request` observable

---

### listenForRead()
Get an observable to be notified when items are read (will also emit on `refresh` reads).
#### Returns
Observable<T[]> - items that were returned by the `request` observable

---

### listenForUpdate()
Get an observable to be notified when some items are updated.
#### Returns
Observable<T[]> - items that were returned by the `request` observable

---
### listenForDelete()
Get an observable to be notified when some items are deleted.
#### Returns
Observable<Partial<T>[]> - items that were provided in params

## Signals
### Fields:

* `itemsSignal`
* `totalCountFetchedSignal`
* `updatingItemsSignal`
* `deletingItemsSignal`
* `mutatingItemsSignal`
* `isCreatingSignal`
* `isReadingSignal`
* `isUpdatingSignal`
* `isDeletingSignal`
* `isSavingSignal`
* `isMutatingSignal`
* `isProcessingSignal`
* `statusesSignal`
* `statusSignal`

### Methods:

* `getViewModelSignal()` - Signal-returning version of `getViewModel()`
* `getItemViewModelSignal()` - Signal-returning version of `getItemViewModelSignal()`
* `getItemSignal()` - Signal-returning version of `getItem()`
* `getItemByFieldSignal()` - Signal-returning version of `getItemByField()`

## Helpers

### getTrackByFieldFn()
Returns a function you can use with "trackBy" in `ngFor`
#### Parameters
* `field: string` - field name

Usage example:
```angular2html
<div *ngFor="let item of $.items; trackBy: collection.getTrackByFieldFn('uuId')"></div>
```

---

### hasItemIn()
Checks if some item belongs to some array of items - a comparator of this collection will be used.
#### Parameters
* `item`
* `array`

Example of usage:
```angular2html
<mat-chip-option
    *ngFor="let role of $.allRoles" 
    [value]="role"
    [selected]="collection.hasItemIn(role, $.roles)"
    [selectable]="false"
>
<span>{{role.name}}</span>
</mat-chip-option>
```
