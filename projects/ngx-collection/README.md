Collection
==========
<p align="center"><img src="./ngx-collection-shield.svg" height="300px"></p>
<p align="center">Collection State Management Service</p>

# Introduction

By using this service, you can easily and safely mutate collections of items and monitor their state (as well as the state of their mutations).

All the actions are asynchronous and immutable - items and collections will not be modified: new items and new collections will be created on every mutation.

To monitor the state, you can use one of the predefined selectors or a view model.

Out of the box, without any additional code, you'll be able to control your "loading" spinners, temporarily disable buttons, display success/error messages, and much more.

Observable-based version extends [NgRx ComponentStore](https://ngrx.io/guide/component-store), all selectors (including view models) are generated using `ComponentStore.select()` method.  

Signal-based version uses only Angular Signals to manage the state (doesn't extend ComponentStore).

# Example Application

You can read an [introductory article](https://medium.com/@eugeniyoz/collection-service-for-angular-d0b64bae9c20) that includes an example of building this application.     

## 🖼️ [StackBlitz](https://stackblitz.com/edit/ngx-collection-example?file=src%2Fapp%2Fcollections%2Fpaintings.collection.ts)  

Here you can see how little code you need to gently manipulate your collection of art! 

# Benefits
✅  Every mutation is asynchronous:  
* works in reactive apps with the OnPush change detection strategy;  
* works in components with the Default change detection strategy;  
* can be used with just the `async` pipe and `subscribe()`, or with some store;
* built-in support for Angular Signals 🚦!

✅  The service is not opinionated:  
* it will not dictate how you should communicate with your APIs or other data sources;    
* you decide how to run and cancel your requests. Every mutation method returns an observable, so you can decide how to orchestrate them using methods like `switchMap()`, `mergeMap()`, `concatMap()`, `forkJoin()`, or something else;  
* Data sources can be synchronous (you can use `of()` or `signal()` for this purpose).  

✅  Safety guarantees:
* 100% immutability;  
* Duplicates prevention;  
* Errors and exceptions will be handled correctly;   
* Strictly typed — advanced type-checking and code completion.

# Installation

Requires Angular 16.   
Observable-based `CollectionService` also requires [NgRx ComponentStore](https://ngrx.io/guide/component-store) 15 or 16.  

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

Or, to use the signal-based version:  
```ts
import { Collection } from 'ngx-collection';
```

# API
The API has a lot of fields and methods, but you don't have to learn and use all of them. Just use the fields and methods that your application needs.

This library provides 2 ways of managing the collection's state: 
* "Observable-based" [CollectionService](projects/ngx-collection/src/lib/collection.service.ts)
* "Signal-based" [Collection](projects/ngx-collection/src/lib/collection.ts)  

Which one to use is your choice :)

* [Core API](projects/ngx-collection/src/lib/types.ts)
* [Observable-based APIs of CollectionService](projects/ngx-collection/src/lib/observable-based.ts)
* [Signal-based APIs of CollectionService](projects/ngx-collection/src/lib/signal-based.ts)

# Usage
Both the signal-based and observable-based classes are designed to be used in 2 ways:  

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
export class BooksCollectionService extends Collection<Book> {
  // to use a global instance, do not add this service to the "providers" array 
  // otherwise, a new (local) instance will be injected.
}
```
For your convenience, there is a protected `init()` method that you can override if you want some special initialization logic, so you don't have to deal with overriding the `constructor()` method.

#### In your Component Store:

```ts
export class BookStore extends ComponentStore<BookStoreState> {
  public readonly coll = inject(BooksCollectionService);
}
```

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
  protected readonly booksSignal = this.store.coll.items;
}
```

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

or using `setOptions()`,  
or by re-instantiating a Comparator:

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

In every params object, `request` is an observable or a signal that you are using to send the request to the API.  
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

# View Model

The simplest way to watch the state of an observable-based collection is to use `collection.getViewModel() | async` in your template.

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

The item's view model is more simple:

* `isDeleting$`
* `isRefreshing$`
* `isUpdating$`
* `isMutating$`
* `isProcessing$`

In both models, `mutating` = (`updating` OR `deleting`).

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
