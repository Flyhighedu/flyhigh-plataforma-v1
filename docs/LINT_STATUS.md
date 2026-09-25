# Estado de ESLint

Revisión del 22 de septiembre de 2026. Alcance: `eslint src`, 448 archivos.

- Antes: 187 errores y 168 advertencias.
- Después: 87 errores y 167 advertencias.
- No se desactivaron reglas para reducir el contador.
- 68 entidades JSX corregidas conservando los caracteres visibles.
- Corregidos hooks condicionales en las dos variantes de PrepChecklist y en imprimibles.
- Corregidas actualizaciones de estado dentro de useMemo, claves de elementos y literales JSX.
- Los problemas restantes incluyen efectos con cambios de estado, operaciones impuras durante render, componentes definidos dentro de otros, refs y una propiedad duplicada en academia. Requieren validación funcional por módulo.

| Regla | Errores | Advertencias |
|---|---:|---:|
| `react-hooks/exhaustive-deps` | 0 | 46 |
| `react-hooks/purity` | 26 | 0 |
| `@next/next/no-img-element` | 0 | 104 |
| `jsx-a11y/alt-text` | 0 | 5 |
| `@next/next/no-page-custom-font` | 0 | 6 |
| `react-hooks/set-state-in-effect` | 41 | 0 |
| `react-hooks/immutability` | 8 | 0 |
| `diagnostic` | 0 | 5 |
| `react-hooks/incompatible-library` | 0 | 1 |
| `react/jsx-no-duplicate-props` | 1 | 0 |
| `react-hooks/refs` | 3 | 0 |
| `react-hooks/preserve-manual-memoization` | 1 | 0 |
| `react-hooks/static-components` | 7 | 0 |

La lista por archivo y línea se guarda en `lint-baseline.json`. `npm run lint` también analiza scripts fuera de src, por lo que su resultado puede ser mayor.
