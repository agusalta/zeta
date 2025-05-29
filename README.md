# Zeta Framework

Zeta es un framework JavaScript minimalista y reactivo para crear interfaces de usuario interactivas. Proporciona una sintaxis declarativa similar a Vue.js pero con una implementación más ligera.

## Características Principales

- Sistema de estado reactivo con Proxy mejorado
- Enlace bidireccional de datos
- Directivas declarativas en el HTML
- Computación de propiedades derivadas
- Observadores de estado mejorados
- Animaciones de entrada con Intersection Observer
- Sistema de helpers personalizables
- Sintaxis unificada de directivas
- Sistema de caché para expresiones y dependencias
- Manejo optimizado de eventos y actualizaciones
- Soporte para templates en iteraciones
- Transformaciones y transiciones CSS mejoradas

## Instalación

Incluye el archivo `zeta.js` en tu proyecto:

```html
<script src="zeta.js"></script>
```

## Configuración

```javascript
// Configurar opciones del framework
Zeta.config({
    requirePrefix: false // Si es true, solo se observan propiedades que existen en el estado
})
```

o

```javascript
// Configurar opciones del framework
<script src="zeta.js" requirePrefix></script>
```

## Uso Básico

### Inicialización

```javascript
Zeta.init({
    count: 0,
    message: 'Hola Mundo'
})
```

o

```javascript
<span z:init="count = 0" z:text="message"></span>
<span z:init="message = 'Hola Mundo'" z:text="message"></span>
```


### Enlace de Datos

```html
<!-- Enlace de texto -->
<span z:text="message"></span>

<!-- Enlace bidireccional con inputs -->
<input z:model="message">

<!-- Usando la sintaxis unificada -->
<span z="text:message"></span>
<input z="model:message">
```

### Eventos

```html
<!-- Evento click -->
<button z:click="state.count++">Incrementar</button>

<!-- Usando la sintaxis unificada -->
<button z="click:state.count++">Incrementar</button>
```

### Directivas Condicionales

```html
<!-- Mostrar/ocultar elementos -->
<div z:if="state.count > 0">El contador es positivo</div>
<div z:show="state.isVisible">Este elemento se puede mostrar/ocultar</div>

<!-- Usando la sintaxis unificada -->
<div z="if:state.count > 0">El contador es positivo</div>
<div z="show:state.isVisible">Este elemento se puede mostrar/ocultar</div>
```

### Clases y Estilos Dinámicos

```html
<!-- Clases condicionales -->
<div z:class="active: state.isActive, hidden: !state.isVisible"></div>

<!-- Estilos dinámicos -->
<div z:style="opacity: state.opacity, transform: state.transform"></div>

<!-- Usando la sintaxis unificada -->
<div z="class:active: state.isActive, hidden: !state.isVisible"></div>
<div z="style:opacity: state.opacity, transform: state.transform"></div>
```

### Iteración de Listas

```html
<!-- Iterar sobre arrays -->
<ul>
    <li z:each="item in state.items">{{item}}</li>
</ul>

<!-- Usando la sintaxis unificada -->
<ul>
    <li z="each:item in state.items">{{item}}</li>
</ul>
```

### Computación de Propiedades

```javascript
Zeta.derive('fullName', () => {
    return state.firstName + ' ' + state.lastName
})
```

### Observadores

```javascript
// Observar una sola propiedad
Zeta.watch('count', (newValue) => {
    console.log('El contador cambió a:', newValue)
})

// Observar múltiples propiedades
Zeta.watch('count, message', (newValue) => {
    console.log('Algo cambió:', newValue)
})
```

### Helpers Personalizados

```javascript
// Registrar un helper
Zeta.helper('formatDate', (date) => {
    return new Date(date).toLocaleDateString()
})

// Usar en el HTML
<span z:text="formatDate(state.date)"></span>
```

### Animaciones de Entrada

```html
<!-- Animación que se ejecuta una vez -->
<div z:fade="once">Este elemento aparecerá con una animación de fade</div>

<!-- Animación que se repite cada vez que el elemento entra en el viewport -->
<div z:fade>Este elemento aparecerá con una animación de fade cada vez que sea visible</div>
```

## API

### Zeta.init(obj)
Inicializa el estado del framework con un objeto.

### Zeta.zeta(key)
Retorna una función getter/setter para una propiedad del estado.

### Zeta.watch(keyOrKeys, callback)
Registra un observador para cambios en una o múltiples propiedades. Ahora incluye validación de propiedades existentes.

### Zeta.derive(key, computeFn)
Define una propiedad computada.

### Zeta.scan()
Escanea el DOM para inicializar todas las directivas. Incluye optimizaciones para el procesamiento de directivas.

### Zeta.helper(name, fn)
Registra una función helper que estará disponible en las expresiones.

### Zeta.config(opts)
Configura opciones del framework.

### Zeta.clearCache()
Limpia la caché de expresiones y dependencias (útil para desarrollo).

## Sintaxis de Directivas

El framework soporta dos formas de usar las directivas:

1. **Atributos separados**: `z:text`, `z:model`, `z:click`, etc.
2. **Atributo unificado**: `z="text:value; click:handler"`

Las directivas disponibles son:
- `text`: Enlace de texto
- `model`: Enlace bidireccional
- `click`: Evento de clic
- `init`: Código de inicialización
- `if`: Renderizado condicional
- `show`: Mostrar/ocultar
- `class`: Clases condicionales
- `style`: Estilos dinámicos
- `each`: Iteración de listas
- `fade`: Animación de entrada

## Consideraciones de Seguridad

El framework utiliza `Function` para evaluar expresiones. Asegúrate de que las expresiones provengan de fuentes confiables y no de entrada de usuario sin sanitizar.

## Estilos CSS para Animaciones

Para que las animaciones de fade funcionen, incluye estos estilos en tu CSS:

```css
.zeta-fade {
    opacity: 0;
    transform: translateY(20px);
    transition: opacity 0.6s ease, transform 0.6s ease;
}

.zeta-fade.zeta-visible {
    opacity: 1;
    transform: translateY(0);
}
```

## Mejoras Recientes

- Optimización del sistema de caché para expresiones y dependencias
- Mejora en el manejo de eventos para evitar duplicación de listeners
- Soporte mejorado para templates en iteraciones con `z:each`
- Validación de propiedades en observadores
- Animaciones de fade mejoradas con transformaciones
- Mejor manejo de errores y logging
- Optimización del procesamiento de directivas
- Soporte para operaciones de incremento/decremento en expresiones
- Mejor manejo de asignaciones en expresiones 