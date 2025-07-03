# LaraView

A dynamic code explorer for Laravel applications that visualizes your project's structure and allows interactive navigation of views and components.

## Tech Stack

- **Frontend**: HTML, JavaScript with GoJS for visualization
- **Backend**: Express.js server
- **Authentication**: Laravel Sanctum for API token authentication
- **Syntax Highlighting**: highlight.js for code display

## Installation

Clone options:
- inside your laravel repo
- outside your laravel repo

```bash
bun install
# or
npm install
```

## Configuration

### view-config.json

The configuration file supports two main sections:
- `targets`: Files/directories to group in the main diagram
- `singles`: Individual files to display in the sidebar

Example configuration:
- if inside a laravel repo, `app_path` should be set to `..`
- otherwise, set it to the relative path
```json
{
  "app_path": "example-app",
  "targets": {
    "models": "app/Models/*",
    "views": "resources/views/**/*.blade.php",
    "controllers": "app/Http/Controllers/*"
  },
  "singles": {
    "config": "config/*.php",
    "routes": "routes/*.php"
  }
}
```

### Symlink Support

LaraView supports symlinks for both files and directories. Create symlinks using:

```bash
# For directories
ln -s /path/to/source/directory /path/to/target/directory

# For files
ln -s /path/to/source/file.php /path/to/target/file.php
```


## Usage

```bash
bun dev
# or
npm dev
```

```
open http://localhost:3000
```

## Features

- Interactive visualization of Laravel project structure
- Live component and view rendering
- Syntax highlighting for code display
- Support for symlinked files and directories
- Configurable file grouping and organization
- Secure authentication using Laravel Sanctum

## Component and View Rendering

The system supports two types of rendering:

1. **Views**: Direct rendering of blade views with props
2. **Components**: Rendering of individual components within a wrapper layout

The component wrapper provides:
- Proper layout context for components
- Attribute bag handling for component props
- Slot content management
- Consistent styling and header display


## Laravel Integration

### API Routes (routes/api.php)

Add these routes to enable view/component rendering:

```php
// Public authentication route
Route::post('/token', function (Request $request) {
    $request->validate([
        'email' => 'required|email',
        'password' => 'required',
    ]);

    $user = User::where('email', $request->email)->first();

    if (! $user || ! Hash::check($request->password, $user->password)) {
        throw ValidationException::withMessages([
            'email' => ['The provided credentials are incorrect.'],
        ]);
    }

    return response()->json([
        'token' => $user->createToken('api-token')->plainTextToken
    ]);
});

// Protected routes for view/component rendering
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/views/{view}', function ($view) {
        $props = request()->query();
        return view($view, compact('props'));
    })->where('view', '.*');

    Route::get('/components/{component}', function ($component) {
        $props = request()->query();
        $view_name = 'components.' . $component;
        return view('component-wrapper', compact('view_name', 'props'));
    })->where('component', '.*');
});
```

### Route Service Provider Configuration

Update your `RouteServiceProvider.php` to include both 'api' and 'web' middleware for the API routes:

```php
$this->routes(function () {
    Route::middleware(['api', 'web'])
        ->prefix('api')
        ->group(base_path('routes/api.php'));

    Route::middleware('web')
        ->group(base_path('routes/web.php'));

    Route::middleware('web')
        ->group(base_path('routes/auth.php'));
});
```

### Component Wrapper (resources/views/component-wrapper.blade.php)

Create a component wrapper view to handle individual component rendering:

```php
<x-app-layout>
    <x-slot name="header">
        <h2 class="font-semibold text-xl text-gray-800 dark:text-gray-200 leading-tight">
            {{ isset($view_name) ? $view_name : 'Component Wrapper' }}
        </h2>
    </x-slot>

    <div class="p-4">
        @if (isset($view_name))
        @php
            $componentBag = new \Illuminate\View\ComponentAttributeBag($props ?? []);
            $view = view($view_name, array_merge($props, ['attributes' => $componentBag, 'slot' => $props['slot'] ?? $view_name]));
            echo $view->render();
        @endphp
        @endif
    </div>
</x-app-layout>
```
