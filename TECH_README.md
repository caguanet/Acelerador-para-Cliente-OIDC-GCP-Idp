# 📘 Technical Documentation (TECH_README)

## 1. 🏗️ Arquitectura de la Solución

### Resumen
Esta solución es un **Identity Provider (IdP)** basado en OIDC (OpenID Connect), diseñado para ser **Stateless**, **Serverless** y **White-Label**. Actúa como una capa de abstracción de seguridad sobre **Firebase Authentication (GCP Identity Platform)**, permitiendo que múltiples aplicaciones (Partners) autentiquen usuarios sin manejar credenciales directamente.

### Principios de Diseño
*   **Identity Broker:** Centraliza la autenticación. Los clientes (Relying Parties) solo ven el IdP, nunca la base de datos de usuarios.
*   **Frontend-Only Security:** La aplicación es una SPA (React) que maneja flujos OIDC implícitos o PKCE. No almacena secretos de servidor (Client Secrets) en el código.
*   **Runtime Configuration:** La configuración se inyecta en tiempo de ejecución (`window.APP_CONFIG`), permitiendo que el mismo artefacto (Docker Image) sirva a múltiples inquilinos o entornos solo cambiando el archivo `config.js` o variables de entorno.

## 2. 🧩 Diagramas de Clases (Componentes)

Muestra la relación entre los componentes principales de React y la configuración.

> **Nota de Sintaxis Mermaid:**
> Para garantizar la compatibilidad estricta del parser y prevenir errores de renderizado, este documento extiende las directivas del *Diagramming Framework* implementando **Sanitización de Literales**. Los nodos con texto complejo (saltos de línea `<br/>`, paréntesis) se encapsulan en comillas dobles/backticks, y los caracteres reservados en conectores se escapan con entidades HTML (e.g., `&lpar;` para `(`, `&rpar;` para `)`).

```mermaid
classDiagram
    class App {
        +User user
        +OIDCParams oidcParams
        +handleLoginSuccess()
        +isValidOrigin()
    }
    class LoginModal {
        +bool isOpen
        +onSignInSuccess()
    }
    class ThemeConfig {
        +string brandName
        +string logoUrl
        +object colors
    }
    class RuntimeConfig {
        +object firebase
        +string[] allowedOrigins
    }
    
    App *-- LoginModal : Renders
    App ..> RuntimeConfig : Reads
    LoginModal ..> ThemeConfig : Styles
```

## 3. 🔄 Diagramas de Secuencia (Casos de Uso)

### A. Flujo de Autenticación OIDC (Happy Path)
El usuario llega desde una App de un Socio (Partner) y se autentica exitosamente.

```mermaid
sequenceDiagram
    participant User as Usuario Final
    participant Client as Partner App (Port 3000)
    participant IdP as Identity Provider (Port 5173)
    participant Firebase as GCP Identity Platform

    User->>Client: Clic en "Login con ETB"
    Client->>IdP: Redirección OIDC (client_id, redirect_uri)
    IdP->>IdP: Validar redirect_uri (Seguridad)
    IdP->>User: Mostrar Login Modal
    User->>IdP: Ingresa Credenciales
    IdP->>Firebase: signInWithEmailAndPassword()
    Firebase-->>IdP: Retorna ID Token (JWT)
    IdP->>Client: Redirección con #id_token=...
    Client->>Client: Validar Token y Crear Sesión
    Client-->>User: Acceso Permitido
```

### B. Intento de Phishing / Redirección No Autorizada (Seguridad)
Un atacante intenta engañar al usuario para que se loguee y enviar el token a un sitio malicioso.

```mermaid
sequenceDiagram
    participant Attacker as Sitio Malicioso
    participant User as Usuario Victima
    participant IdP as Identity Provider

    Attacker->>User: Link con redirect_uri=http://evil.com
    User->>IdP: Accede al Link
    IdP->>IdP: Validar link vs allowedOrigins
    alt Origen NO Autorizado
        IdP--xUser: Muestra Error de Seguridad
        Note right of IdP: NO permite login.<br/>NO emite token.
    end
```

## 4. ☁️ Arquitectura de Despliegue en Nube

### A. Mínima Viable (MVP / Dev)
Despliegue directo en **Cloud Run**. SSL gestionado automáticamente por Google.

```mermaid
graph LR
    User((Internet User))
    subgraph GCP Project
        LB[Cloud Run Load Balancer]
        Service["`Cloud Run Service<br/>(IdP Container)`"]
        Auth[Identity Platform]
    end
    User --> LB
    LB --> Service
    Service --> Auth
```

### B. Recomendada (Producción / Enterprise)
Arquitectura robusta con **Cloud CDN** para assets estáticos y **Cloud Armor** (WAF) para protección contra ataques (DDoS, SQLi, XSS).  

```mermaid
graph TD
    User((Internet User))
    
    subgraph "Google Cloud Platform"
        WAF["`Cloud Armor (WAF)`"]
        LB["`Global Load Balancer`"]
        CDN["`Cloud CDN`"]
        
        subgraph "`Cloud Run (Serverless)`"
            IdP["`IdP Instances<br/>(Autoscaling 1-N)`"]
        end
        
        subgraph "`Security`"
            Secret[Secret Manager]
            Auth["`Identity Platform<br/>(Tenant Management)`"]
        end
    end

    User --> WAF
    WAF --> LB
    LB -->| Static Content &lpar;JS/CSS&rpar;| CDN
    LB -->| Dynamic Requests| IdP
    IdP --> Auth
    IdP -.->|Read Config| Secret
```

## 5. 🛡️ Guía de Seguridad y Buenas Prácticas

1.  **Whitelisting:** Nunca despliegues a producción sin configurar exhaustivamente `APP_CONFIG.allowedOrigins`. Cualquier origen no listado será bloqueado.
2.  **Tokens:** El IdP emite tokens de corta duración (1 hora). La renovación debe manejarse en el cliente (silent refresh) o re-autenticando.
3.  **Logs:** No loguear información personal (PII) ni tokens en la consola del navegador ni en los logs de Cloud Run.
