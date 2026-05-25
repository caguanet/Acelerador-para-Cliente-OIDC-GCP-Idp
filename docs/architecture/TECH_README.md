# 📘 Technical Documentation (TECH_README)

## 1. 🏗️ Arquitectura de la Solución

### Resumen

Esta solución es un **Identity Provider (IdP)** basado en OIDC (OpenID Connect), diseñado para ser **Stateless**, **Serverless** y **White-Label**. Actúa como una capa de abstracción de seguridad sobre **Firebase Authentication (GCP Identity Platform)**, permitiendo que múltiples aplicaciones (Partners) autentiquen usuarios sin manejar credenciales directamente.

### Principios de Diseño

* **Identity Broker:** Centraliza la autenticación. Los clientes (Relying Parties) solo ven el IdP, nunca la base de datos de usuarios.
* **Frontend-Only Security (Implicit Flow):** La solución implementa estrictamente **OIDC Implicit Flow** (ideal para SPAs Serverless).
* La detección de `redirect_uri`, `client_id` y `prompt` en la cadena de consulta ocurre **en el primer ciclo de render** para evitar un fotograma intermedio con estado incorrecto cuando el usuario llega desde un cliente OIDC.
  > **Nota:** No soporta PKCE (Proof Key for Code Exchange) actualmente, ya que requeriría persistencia de backend (Stateful). Esta decisión prioriza **Simplicidad y Costo Cero** sobre la seguridad de grado bancario (OAuth 2.1), siendo suficiente para integraciones estándar.
* **Runtime Configuration:** La configuración se inyecta en tiempo de ejecución (`window.APP_CONFIG`), permitiendo que el mismo artefacto (Docker Image) sirva a múltiples inquilinos o entornos solo cambiando el archivo `config.js` o variables de entorno.

## 2. 🧩 Diagramas de Clases (Componentes)

Muestra la relación entre los componentes principales de React y la configuración.

> **Nota de Sintaxis Mermaid:**
> Para garantizar la compatibilidad estricta del parser y prevenir errores de renderizado, este documento extiende las directivas del *Diagramming Framework* implementando **Sanitización de Literales**. Los nodos con texto complejo (saltos de línea `<br/>`, paréntesis) se encapsulan en comillas dobles/backticks, y los caracteres reservados en conectores se escapan con entidades HTML (e.g., `&lpar;` para `(`, `&rpar;` para `)`).

```mermaid
classDiagram
    class App {
        +OIDCParams oidcParams
        +AuthView authView
        +handleLoginSuccess()
        +isValidOrigin()
    }
    class PasswordlessLoginForm {
        +sendSignInLinkToEmail()
        +signInWithEmailLink()
        +sendPasswordResetEmail()
        +signInWithPopup()
        +onGoToRegister()
    }
    class ThemeConfig {
        +string brandName
        +string logoUrl
        +object colors
        +object hero
    }
    class RuntimeConfig {
        +string MODE
        +object firebase
        +string[] allowedOrigins
        +bool enableLandingPage
        +string IDP_URL
        +string BACKEND_URL
        +string MOCK_CLIENT_URL
        +object theme
    }

    App *-- PasswordlessLoginForm : Renders email link login
    App *-- RegisterForm : Renders registration
    App ..> RuntimeConfig : Reads window.APP_CONFIG
    PasswordlessLoginForm ..> ThemeConfig : Styles
```

> **Login principal:** `App` muestra `PasswordlessLoginForm` con acceso por correo mediante Firebase Email Link/passwordless (`sendSignInLinkToEmail` y `signInWithEmailLink`). El mismo micrositio permite recuperación de contraseña con `sendPasswordResetEmail` para servicios externos que usan la contraseña creada durante el registro ETB. El OTP corto queda reservado para registro/alta digital ETB o una fase futura con BFF, no para el login principal del IdP.

### Mapa De Funcionalidades De Autenticación

```mermaid
flowchart TD
    U["Usuario final"] --> IDP["Micrositio IdP"]

    IDP --> EL["Login email link/passwordless"]
    EL --> EL1["Ingresa correo"]
    EL1 --> EL2["Firebase envía enlace seguro"]
    EL2 --> EL3["signInWithEmailLink"]
    EL3 --> OIDC["Emisión OIDC implicit<br/>redirect_uri#id_token"]

    IDP --> REC["Recuperación de contraseña"]
    REC --> REC1["Ingresa correo"]
    REC1 --> REC2["sendPasswordResetEmail"]
    REC2 --> REC3["Define nueva contraseña<br/>para servicios externos/API"]

    IDP --> SOC["Google / Apple / Facebook"]
    SOC --> SOC1{"Cuenta social<br/>validada o vinculada?"}
    SOC1 -- "Sí" --> OIDC
    SOC1 -- "No" --> REG["Registro ETB obligatorio"]

    IDP --> REG
    REG --> HOG["Hogares"]
    REG --> MIP["MiPymes"]
    HOG --> VAL["Validación ETB + OTP de registro"]
    MIP --> VAL
    VAL --> BFF["BFF / MuleSoft / MS-4"]
    BFF --> GCP["Identity Platform<br/>usuario + contraseña + claims"]
    GCP --> LINK["Vinculación social post-registro<br/>si aplica"]
    LINK --> OIDC
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
    User->>IdP: Ingresa correo
    IdP->>Firebase: sendSignInLinkToEmail()
    Firebase-->>User: Envia enlace seguro de acceso
    User->>IdP: Abre enlace de acceso
    IdP->>Firebase: signInWithEmailLink()
    Firebase-->>IdP: Retorna ID Token (JWT)
    IdP->>Client: Redirección con #id_token=...
    Client->>Client: Validar Token y Crear Sesión
    Client-->>User: Acceso Permitido
```

### B. Flujo Integral De Funcionalidades Del IdP

```mermaid
flowchart TD
    START["Usuario llega al IdP"] --> PARAMS{"Trae client_id<br/>y redirect_uri?"}
    PARAMS -- "No" --> STANDALONE["Vista standalone<br/>sin emisión OIDC"]
    PARAMS -- "Sí" --> ORIGIN{"redirect_uri autorizado?"}
    ORIGIN -- "No" --> BLOCK["Bloquear acceso<br/>sin renderizar login ni emitir token"]
    ORIGIN -- "Sí" --> ENTRY["Mostrar micrositio IdP"]

    ENTRY --> CHOICE{"Acción del usuario"}

    CHOICE --> EMAIL["Login por correo"]
    EMAIL --> SENDLINK["Enviar email link Firebase"]
    SENDLINK --> OPENLINK["Usuario abre enlace"]
    OPENLINK --> VALIDLINK{"Enlace válido<br/>y usuario habilitado?"}
    VALIDLINK -- "Sí" --> TOKEN["Obtener id_token"]
    VALIDLINK -- "No" --> EMAILERR["Mostrar error amigable<br/>o pedir nuevo enlace"]

    CHOICE --> SOCIAL["Login con red social"]
    SOCIAL --> SOCIALOK{"Proveedor vinculado<br/>o usuario ETB validado?"}
    SOCIALOK -- "Sí" --> TOKEN
    SOCIALOK -- "No" --> REGSTART["Iniciar registro ETB<br/>sin alta social libre"]

    CHOICE --> REGISTER["Registro por formulario"]
    REGISTER --> REGSTART
    REGSTART --> CUSTOMER{"Tipo de cliente"}
    CUSTOMER --> HOGARES["Hogares:<br/>documento + términos"]
    CUSTOMER --> MIPYMES["MiPymes:<br/>NIT + representante"]
    HOGARES --> OTP["OTP de registro ETB"]
    MIPYMES --> OTP
    OTP --> MS4["BFF valida OTP<br/>y ejecuta alta digital"]
    MS4 --> CREATE["Crear/actualizar usuario<br/>con contraseña y claims"]
    CREATE --> PENDING{"Registro inició<br/>desde red social?"}
    PENDING -- "Sí" --> LINKSOC["Vincular proveedor social"]
    PENDING -- "No" --> TOKEN
    LINKSOC --> TOKEN

    CHOICE --> RECOVERY["Recuperar contraseña"]
    RECOVERY --> RESET["sendPasswordResetEmail"]
    RESET --> RESETDONE["Usuario define nueva contraseña<br/>para servicios externos/API"]
    RESETDONE --> ENTRY

    TOKEN --> REDIRECT["Redirigir a redirect_uri#id_token=..."]
```

### C. Intento de Phishing / Redirección No Autorizada (Seguridad)

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

1. **Whitelisting:** Nunca despliegues a producción sin configurar exhaustivamente `APP_CONFIG.allowedOrigins`. Cualquier origen no listado será bloqueado.
2. **Tokens:** El IdP emite tokens de corta duración (1 hora). La renovación debe manejarse en el cliente (silent refresh) o re-autenticando.
3. **Logs:** No loguear información personal (PII) ni tokens en la consola del navegador ni en los logs de Cloud Run.
4. **API Hardening:** Siga el principio de privilegio mínimo en GCP. Restrinja sus API Keys para que solo puedan llamar a los servicios necesarios (`Identity Toolkit`, `Token Service`) y solo desde dominios conocidos (Referrers).
