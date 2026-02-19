# Getting Started

## What ngx-collection solves

In Angular applications, managing a list of items (users, products, notifications, etc.) involves a surprising amount of complexity:

- Keeping the list in sync across multiple components
- Tracking loading, saving, and deleting states for the list and individual items
- Handling errors gracefully without corrupting state
- Preventing race conditions when multiple async operations overlap
- Avoiding duplicates when items come from different sources

`ngx-collection` provides a single `Collection` class that handles all of this. You describe *what* you want to do (create, read, update, delete), and the library takes care of the rest — state updates, loading flags, error reporting, and concurrent operation safety.

Every piece of state is exposed as an Angular Signal, so your templates update automatically with zero boilerplate.

## Installation

Requires Angular 17+.

```bash
npm i ngx-collection
```

```ts
import { Collection } from 'ngx-collection';
```

## Minimal example

```ts
interface Book {
  id: number;
  title: string;
  author: string;
}

@Component({
  selector: 'app-books',
  standalone: true,
  template: `
    @if (books.$isReading()) {
      <p>Loading...</p>
    }

    @for (book of books.$items(); track book.id) {
      <div>{{ book.title }} by {{ book.author }}</div>
    }

    @if (!books.$isReading() && books.$items().length === 0 && !books.$isBeforeFirstRead()) {
      <p>No books found.</p>
    }
  `
})
export class BooksComponent {
  private readonly http = inject(HttpClient);
  protected readonly books = new Collection<Book>({ comparatorFields: ['id'] });

  constructor() {
    this.books.read({
      request: this.http.get<Book[]>('/api/books'),
      onError: (err) => console.error('Failed to load books', err),
    });
  }
}
```

With just this, you get:

- `$items()` — the list of books, updated automatically
- `$isReading()` — `true` while the HTTP request is in flight
- `$isBeforeFirstRead()` — `true` until the first read completes, so you can distinguish "not loaded yet" from "loaded but empty"

## Instantiation patterns

You can use `Collection` in three ways, depending on how broadly you want the state to be shared.

### Local collection

Create it directly in a component. Only that component can access it.

```ts
@Component({
  selector: 'app-books',
  standalone: true,
  // ...
})
export class BooksComponent {
  protected readonly books = new Collection<Book>({ comparatorFields: ['id'] });
}
```

### Feature-scoped collection

Create an `@Injectable` subclass and provide it at a feature level. All child components share the same instance.

```ts
@Injectable()
export class BooksCollection extends Collection<Book> {
  constructor() {
    super({ comparatorFields: ['id'] });
  }
}

@Component({
  selector: 'app-books-page',
  standalone: true,
  providers: [BooksCollection],
  // ...
})
export class BooksPageComponent {
  protected readonly books = inject(BooksCollection);
}
```

Any child component within `BooksPageComponent` can also `inject(BooksCollection)` and will receive the same instance. When the user navigates away, the instance is destroyed.

### Global collection

Use `providedIn: 'root'` to make the collection a singleton available everywhere.

```ts
@Injectable({ providedIn: 'root' })
export class BooksCollection extends Collection<Book> {
  constructor() {
    super({ comparatorFields: ['id'] });
  }
}
```

This is useful when multiple unrelated parts of your app (a list component and a detail component on different routes, for example) need to share the same data. Changes made anywhere are instantly visible everywhere.

## Constructor options

The most common options you'll pass to the constructor:

| Option | Description |
|---|---|
| `comparatorFields` | Fields used to identify items (e.g., `['id']`). See [Item Comparison](comparator.md). |
| `errReporter` | A function to log errors (e.g., `console.error`). See [Error Handling](error-handling.md). |
| `throwOnDuplicates` | A message string — if set, duplicate detection throws an exception instead of silently reporting. |
| `allowFetchedDuplicates` | Whether `read()` accepts responses containing duplicates (default: `true`). |
| `readFrom` | Reactive source that auto-feeds `read()`. See [CRUD Operations](crud-operations.md#reactive-reads). |
| `readManyFrom` | Reactive source that auto-feeds `readMany()`. See [CRUD Operations](crud-operations.md#reactive-reads). |
| `onFirstItemsRequest` | Callback invoked once when `$items()` is first read. Useful for lazy loading. |

For the full list, see the [API Reference](api-reference.md).

## Next steps

- [Core Concepts](core-concepts.md) — understand how the library manages state and handles concurrency
- [CRUD Operations](crud-operations.md) — learn every method for reading, creating, updating, and deleting items
- [State Signals](state-signals.md) — explore all the signals available for templates and computed logic
