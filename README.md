Collection
==========
<p align="center"><img src="./ngx-collection.svg" height="300px"></p>
<p align="center">Collection State Management Service</p>

# Introduction

By using this service, you can easily and safely modify collections of items and monitor their state (as well as the state of their modifications).

All the actions are immutable - items will not be modified.

Collection method calls can be completely synchronous, or asynchronous (preventing data race in asynchronous calls).  

Out of the box, without any additional code, you'll be able to control your "loading" spinners, temporarily disable buttons, display success/error messages, and much more.

# Example Application

You can read an [introductory article](https://medium.com/@eugeniyoz/collection-service-for-angular-d0b64bae9c20) that includes an example of building this application.     

## 🖼️ [StackBlitz](https://stackblitz.com/edit/ngx-collection-example?file=src%2Fapp%2Fcollections%2Fpaintings.collection.ts)  

Here you can see how little code you need to gently manipulate your collection of art! 

# Benefits
✅  No data race in asynchronous calls:  
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
import { Collection } from 'ngx-collection';
```

# API
The API has a lot of fields and methods, but you don't have to learn and use all of them.   
Just use the fields and methods that your application needs.  
No worries, in your app you'll use just a few methods and even fewer fields.   
API has all these methods and fields to be flexible for many different types of usage.

* [API](projects/ngx-collection/src/lib/types.ts)

# Usage
You can use `Collection` class as is, or you can use it inside an `@Injectable` class, or you can create an `@Injectable` class, extending `Collection` class.    

With `@Injectable`, you can control how the instance will be shared across the components.

## Mutations

The Collection Service has four main methods to mutate a collection: `create()`, `read()`, `update()`, `delete()`.

### Create
Call `create` to add a new item to a collection:

```ts
this.booksCollection.create({
  request: this.booksService.saveBook(bookData),
  onSuccess: () => this.messageService.success('Created'),
  onError: () => this.messageService.error('Error'),
})
```

### Read
`read()` will load the list of items:
```ts
this.booksCollection.read({
    request: this.booksService.getBooks(),
    onError: () => this.messageService.error('Can not load the list of books')
  })
```

### Update
Use `update()` to modify some particular item in your collection:
```ts
this.booksCollection.update({
  request: this.booksService.saveBook(bookData),
  item: bookItem,
  onSuccess: () => this.messageService.success('Saved'),
  onError: () => this.messageService.error('Error'),
})
```

### Delete
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
              request: book.uuId ? this.booksService.removeBook(book.uuId) : undefined,
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

## Instantiation Examples

### Local collection
```ts
@Component({
  selector: 'example',
  standalone: true,
  ///...
})
export class ExampleComponent {
  // this collection will be only accessible to this component
  protected readonly collection = new ExampleCollection({comparatorFields: ['id']});
}
```

### "Feature" collection

```ts
@Injectable()
export class ExampleCollection extends Collection<Example> {
   constructor() {
      super({comparatorFields: ['id']});
   }
}

@Component({
   selector: 'example',
   // ...
   providers: [
      ExampleCollection, // 👈 You need to declare it as a provider 
                         // in the "container" component of the "feature" 
                         // or in the Route object, that declares a route to the "feature".
                         // Other components (of the "feature") will inherit it from the parent components.
   ]
})
export class ExampleComponent {
   protected readonly coll = inject(ExampleCollection);
}
```

### Global collection

If you want to access some collection from any component, you can create a global collection.  

One example use case is having a list of items (ListComponent), and every item is rendered using a component (ListItemComponent). 
If both ListComponent and ListItemComponent use the same shared collection, changes made to one of them will be instantly reflected in the other.  

To create a global collection, create a new class that extends this service and add the `@Injectable({providedIn: 'root'})` decorator:

```ts
@Injectable({ providedIn: 'root' })
export class BooksCollection extends Collection<Book> {
   constructor() {
      super({comparatorFields: ['id']});
   }
}
```

#### In your component:

```ts
@Component({
  selector: 'book',
  standalone: true,
  ///...
  providers: [
    //...
    // BooksCollection should not be added here ⚠️
  ], 
})
export class BookComponent {
  protected readonly books = inject(BooksCollection);
}
```

#### If you want to use it in a store:

```ts
export class BookStore extends ComponentStore<BookStoreState> {
  public readonly coll = inject(BooksCollection);
}
```

## Statuses
You can set statuses for the items. Statuses can be unique per collection (for example: 'focused') or not (for example: 'selected'). 
Statuses are not predefined; you can use your list of statuses. The service only needs to know if a given status is unique or not unique.

## Items comparison
The equality of items will be checked using the comparator, which you can replace using the `setComparator()` method.

The comparator will first compare items using `===`, then it will use id fields.

You can check the default id fields list of the default comparator in the [comparator.ts](projects/ngx-collection/src/lib/comparator.ts) file.

You can easily configure it using `constructor()`, `setOptions()`, or by re-instantiating a Comparator, or by providing your own Comparator - it can be a class, implementing `ObjectsComparator` interface, or a function, implementing `ObjectsComparatorFn`.

```ts
export class NotificationsCollection extends Collection<Notification> {
  constructor() {
    super({ comparatorFields: ['id'] });
  }

  override init() {
    // or
    this.setOptions({ comparatorFields: ['uuId', 'url'] });

    // or:
    this.setComparator(new Comparator(['signature']));

    // or:
    this.setComparator((a, b) => a.id === b.id);
  }
}
```

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
  remove = createEffect<Example>(_ => _.pipe(
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
  remove = createEffect<string>(_ => _.pipe(
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

## Helpers

### getTrackByFieldFn()
Returns a function you can use with "trackBy" in `ngFor`
#### Parameters
* `field: string` - field name

Usage example:
```angular2html
<div *ngFor="let item of $items(); trackBy: coll.getTrackByFieldFn('uuId')"></div>
```

---

### createEffect()
Copy of `ComponentStore.effect()` method from NgRx, where `takeUntil(this.destroy$)` is replaced with `takeUntilDestroyed(destroyRef)`, to use it as a function.  

`createEffect()` is not a method of `Collection` class, it's a standalone function.  

You can find documentation and usage examples here: https://ngrx.io/guide/component-store/effect#effect-method  

---

### hasItemIn()
Checks if some item belongs to some array of items - a comparator of this collection will be used.
#### Parameters
* `item`
* `array`

Example of usage:
```angular2html
<mat-chip-option
    *ngFor="let role of $allRoles()" 
    [value]="role"
    [selected]="coll.hasItemIn(role, $roles())"
    [selectable]="false"
>
<span>{{role.name}}</span>
</mat-chip-option>
```

---

### postInit()
For your convenience, there is a protected `init()` method that you can override if you want some special initialization logic, so you don't have to deal with overriding the `constructor()` method.  
Original method is guaranteed to be empty, so you don't have to call `super.init()`.  
Will be called from the `constructor()`.

---

### asyncInit()
Another method you can safely override.  
Original method is guaranteed to be empty, so you don't have to call `super.asyncInit()`.  
Will be called in the next microtask from the constructor (`init()` will be called first and in the current microtask).

---

### signalEqual
Object you can import.   
Contains functions for checking the equality of values, optimized for arrays, maps, sets, and objects.

The goals of these functions are:  
1. To reduce the number of unnecessary computations;  
2. To compare values as quickly as possible.  

First of all, if values are equal by reference (`===`), they are considered equal.  
After that, for arrays, sets, maps, and objects, the first level of contained items (keys) will be compared using `===`.  
If values are empty sets, arrays, or maps, they are equal. Empty objects are not equal.    
If both values are `null` or `undefined`, they are equal.    
The check is non-recursive and shallow.  
For a recursive, deep equality check, use specialized and optimized functions that you trust.
