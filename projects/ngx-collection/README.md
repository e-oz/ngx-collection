Collection
==========
Collection State Management Service

# Introduction

Using this service, you can easily and safely mutate collections of items and monitor their state.  

All the actions are immutable - items and collections will not be modified: new items and new collections will be created on every mutation.  

For monitoring the state, you can use one of the predefined selectors, or view model.  

Out of the box, without any additional code, you'll be able to control your "loading" spinners, temporarily disable buttons, display success/error messages, and much more. 

Service is built on top of [NgRx ComponentStore](https://ngrx.io/guide/component-store), all the selectors (including view models) are generated using `ComponentStore.select()`.

# Installation

Requires Angular 15 and [NgRx ComponentStore](https://ngrx.io/guide/component-store) 15  

Yarn: 
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

1. Local collection - temporary instance, with lifecycle bound to a component;
2. Shared collection - a global singleton.

## Examples

It is possible to use this service right in your component, but it is a good practice to move all the state management out of a component to a "store".
Because of that, examples will rely on [ComponentStore](https://ngrx.io/guide/component-store) usage.

### Local collection
A local collection will be destroyed with a component.

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
  
  // Usage of `inject()` is required here (to make CollectionService instance accessible in the ExampleStore).
  // Declare it before usage of the "store" field.
  protected readonly store = inject(ExampleStore);

  // here you can use the "store" field already
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

If you want to share some collection of items between multiple components, you can create a shared collection.

One of the usage examples: you have some list of the items (ListComponent), and every item is rendered using a component (ListItemComponent).   
In this case, if ListComponent and ListItemComponent will use the same shared collection, then changes made in of them will be instantly reflected in another.

To make a shared collection, create a new class extended from this service and add `@Injectable({providedIn: 'root'})`:  

```ts
@Injectable({providedIn: 'root'})
export class BooksCollectionService extends CollectionService<Book> {
  // to use a global instance, do not add this service to the "providers" array 
  // otherwise, a new (local) instance will be injected.
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

The most simple way to watch the state of a collection is to use `collection.getViewModel() | async` in your template.

ViewModel contains a lot of useful fields:  

* `items`[]
* `isCreating`
* `isReading`
* `isUpdating`
* `isDeleting`
* `isMutating`
* `isSaving`
* `updatingItems`[]
* `deletingItems`[]

and some others.


Alternatively, you can use `collection.state$` or any other public field and method of the Collection Service class.

If your component is rendering one of the collection's items, you can use `getItemViewModel()` method to monitor the state changes of your item.  

Item's view model is more simple:  

* `isDeleting`
* `isRefreshing`
* `isUpdating`
* `isMutating`
* `isProcessing`

In both models, `mutating` = (`updating` OR `deleting`).

### Mutations

Collection Service has 4 main methods to mutate a collection: `create()`, `read()`, `update()`, `delete()`.  

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
The usage of `delete()` is obvious, let's use a bit more wordy example:
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
You can set statuses for the items: statuses can be unique per collection (for example: "focused"), or not (for example: "selected").  
Statuses are not predefined - you can use your list of statuses, the service only should know if a given status is unique or not unique.

## Items comparison
The equality of items will be checked using the comparator that you can replace using `setComparator()` method.

The comparator will compare items using `===` first, then it will use id fields.

You can check the id fields list of the default comparator in [comparator.ts](projects/ngx-collection/src/lib/comparator.ts) file.

## Duplicates prevention

Collection Service will not allow duplicates in the collection.   

Item will be checked before adding to the collection in methods `create()`, `read()`, `update()`, and `refresh()`.

To find a duplicate, items will be compared by comparator - objects equality check is a vital part of this service, and with duplicates this functionality will be broken.    

A collection might have duplicates because of some data error or because of wrong fields in the comparator - you can redefine them.  

If a duplicate is detected, the item will not be added to the collection and an error will be printed to the console (if `window.console` does exist).  
You can call `setThrowOnDuplicates('some message')` to make Collection Service throw an exception with the message you expect.

Method `read()` by default will put returned items to the collection even if they have duplicates, but `console.error` will be raised (if `window.console` exists), 
because in this case you have a chance to damage your data in future `update()`.    
You can call `setAllowFetchedDuplicates(false)` to instruct `read()` to not accept items lists with duplicates. 

## Request parameters

### request

In every params object, `request` is an observable you are using to send the request to API:

```ts
  return this.exampleCollection.update({
    request: this.exampleService.saveExample(data),
    item: exampleItem,
    onSuccess: () => this.messageService.success('Saved'),
    onError: () => this.messageService.error('Error'),
  });
```

### item

Parameter `item` is the item that you are mutating.  
You are receiving this item from the `items` field of the collection state.

```ts
  remove = this.effect<Example>(_ => _.pipe(
    exhaustMap((example) => {
      return this.examplesCollection.delete({
        request: example.uuId ? this.exampleService.removeExample(example.uuId) : of(null),
        item: example,
        onSuccess: () => this.messageService.success('Removed'),
        onError: () => this.messageService.error('Error'),
      });
    })
  ));
```

If you can not provide this object, you might send any object containing the id field (with a matching id). See "Items comparison" for details.

```ts
  remove = this.effect<string>(_ => _.pipe(
    exhaustMap((uuId) => {
      return this.examplesCollection.delete({
        request: uuId ? this.exampleService.removeExample(uuId) : of(null),
        item: {uuId: uuId},
        onSuccess: () => this.messageService.success('Removed'),
        onError: () => this.messageService.error('Error'),
      });
    })
  ));
```

# Pipes

This library provides 2 Angular pipes to ease the usage of collection statuses:  

* [UniqueStatusPipe](projects/ngx-collection/src/lib/status.pipes.ts)
* [StatusesPipe](projects/ngx-collection/src/lib/status.pipes.ts)

# Interface `FetchedItems<T>`

`Collection.read()` method additionally supports a specific type from the request execution result: not just a list of items, but a wrapper, containing a list of items:  
[FetchedItems](projects/ngx-collection/src/lib/interfaces.ts)   

You can (optionally) use this or a similar structure to don't lose meta information, such as the total count of items (usually needed for pagination).
