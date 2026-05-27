# Plantillas de correo Firebase Auth / Identity Platform con marca ETB

Fecha de preparacion: 2026-05-25.

Esta guia cubre los correos que salen desde Firebase Authentication / Google Cloud Identity Platform para el proyecto `etb-identity-omnicanal`, manteniendo envio desde Firebase/Google y aplicando marca ETB en remitente, dominio, enlaces y cuerpo HTML.

## 1. Decision recomendada

Objetivo:

- Los correos deben seguir saliendo desde Firebase / Identity Platform, no desde SMTP corporativo ni proveedor de correo propio.
- El usuario debe ver una identidad ETB: remitente ETB, dominio ETB en el `From`, enlaces con dominio ETB y plantilla visual alineada a la aplicacion.
- Las imagenes de marca deben cargarse desde un HTTPS publico de ETB o CDN corporativo.

Recomendacion tecnica:

| Elemento | Valor recomendado |
| --- | --- |
| Proyecto Firebase/GCP | `etb-identity-omnicanal` |
| Metodo de envio | `DEFAULT` en Identity Platform. No configurar `CUSTOM_SMTP`. |
| Nombre remitente | `ETB` o `ETB - Mi ETB` |
| Local-part remitente | `noreply` |
| Dominio remitente preferido | `idp.etb.com` o `notificaciones.etb.com` |
| Remitente resultante | `noreply@idp.etb.com` o `noreply@notificaciones.etb.com` |
| Dominio de action links | `idp.etb.com` o el dominio productivo oficial del IdP |
| Logo email | PNG publico, no SVG, idealmente `https://cdn.etb.com/.../etb-logo-email.png` |
| Tipografia email | System fonts. No depender de Google Fonts ni Adobe Fonts en correos. |

Si el area exige `noreply@etb.com` exacto, se puede intentar con el dominio raiz `etb.com`, pero no es la primera opcion: tocar el apex suele requerir combinar SPF existente, revisar DMARC y coordinar con el gobierno de correo corporativo. Para reducir riesgo, usar subdominio dedicado (`idp.etb.com`, `notificaciones.etb.com` o el que apruebe Seguridad).

## 2. Lo que se debe pedir a cada area

### DNS / dominios

Se necesita que creen los registros DNS exactos que muestre Firebase al usar `Personalizar dominio`. No se deben inventar los valores; Firebase mostrara TXT, CNAME y, si aplica, SPF/DKIM.

Dominio propuesto:

```text
idp.etb.com
```

Alternativas aceptables:

```text
notificaciones.etb.com
cuentas.etb.com
auth.etb.com
```

Reglas para DNS:

- TTL sugerido para implementacion: `300` segundos mientras se valida; despues puede subir a estandar ETB.
- Si Firebase pide un TXT `v=spf1...` y ya existe SPF para el mismo nombre, no crear dos SPF. Se debe combinar en un unico registro SPF.
- No borrar registros existentes de ETB sin aprobacion de gobierno DNS.
- Esperar hasta 24 horas para que Firebase marque verificacion completa.

### Marca / comunicaciones

Se necesita aprobar:

- Logo ETB en PNG para email, preferiblemente a 2x:
  - ancho visual sugerido: `96px` a `120px`;
  - archivo: PNG transparente o PNG sobre azul ETB;
  - peso ideal: menor a `80 KB`.
- Uso de paleta:
  - Azul profundo: `#214780`;
  - Azul ETB: `#004c8f`;
  - Azul interaccion: `#0092bc`;
  - Acento cian: `#00E5FF`, solo como detalle;
  - Texto: `#080707`;
  - Texto secundario: `#515151`;
  - Fondo: `#F8F9FB`.
- Copy de seguridad en tono cercano, claro y funcional.
- URL oficial de ayuda o contacto.

### CDN / activos web

Si el logo o header se sirven desde CDN ETB:

- La URL debe ser publica, HTTPS, sin autenticacion, sin firma temporal y sin tokens que expiren.
- No debe requerir cookies, VPN, App Check, referer especifico ni IP corporativa.
- Debe permitir carga desde proxies de imagen de Gmail, Outlook, Apple Mail, Yahoo y clientes moviles.
- Debe soportar cache publico.
- Debe entregar `Content-Type: image/png`.
- Debe tener certificado TLS valido para el dominio.

Ejemplo de URL esperada:

```text
https://cdn.etb.com/idp/email/etb-logo-email.png
```

Si no existe CDN corporativo para esto, puede usarse una ruta publica del dominio del IdP:

```text
https://idp.etb.com/branding/email/etb-logo-email.png
```

### Seguridad / correo corporativo

Se necesita validar:

- Dominio remitente aprobado (`idp.etb.com`, `notificaciones.etb.com` o `etb.com` si insisten en apex).
- Alineacion SPF/DKIM/DMARC que Firebase solicite.
- Politica DMARC del dominio/subdominio.
- Direccion `Reply-To` aprobada, por ejemplo:

```text
servicioalcliente@etb.com.co
```

o la cuenta que defina ETB para soporte de identidad digital.

Importante: no se pide SMTP corporativo. Se pide permitir que Firebase/Google envie correos de autenticacion usando dominio ETB verificado.

### Administradores GCP/Firebase

Se necesita una persona con permisos sobre el proyecto `etb-identity-omnicanal`, idealmente con rol equivalente a `Identity Platform Admin`, para:

- Actualizar plantillas en Firebase Console.
- Configurar dominio personalizado en cada plantilla.
- Revisar dominios autorizados.
- Habilitar `bodyFormat: HTML` si la consola pega el HTML como texto plano.
- No activar `Configuracion del SMTP`.

## 3. Configuracion en Firebase Console

URL directa:

```text
https://console.firebase.google.com/u/0/project/etb-identity-omnicanal/authentication/emails
```

Ruta:

```text
Firebase Console > Project: ETB-Identity-Omnicanal > Authentication > Templates
```

En la pantalla mostrada:

1. Confirmar que esta seleccionado el tenant/usuario correcto en el selector superior. En la captura se ve `Usuario predeterminado`.
2. Entrar a cada plantilla:
   - `Verificacion de direccion de correo electronico`;
   - `Restablecer contrasena`;
   - `Cambio de direccion de correo electronico`;
   - `Notificacion sobre la inscripcion de segundo factor`, si esta habilitada.
3. Click en el icono de lapiz.
4. Configurar:
   - `Nombre del remitente`: `ETB - Mi ETB`
   - `De`: `noreply`
   - `Responder a`: correo aprobado por ETB, por ejemplo `servicioalcliente@etb.com.co`
   - `Asunto`: usar el asunto de cada plantilla de las secciones 9 a 12.
   - `Mensaje`: pegar el HTML de cada plantilla, si el cuerpo esta habilitado.
5. Click en `Personalizar dominio`.
6. Escribir el dominio aprobado, por ejemplo:

```text
idp.etb.com
```

7. Copiar la tabla de registros DNS que muestra Firebase y enviarla al area DNS.
8. Cuando Firebase muestre verificacion completa, click en `Apply Custom Domain` / `Aplicar dominio personalizado`.

Nota: la documentacion de Firebase indica que el dominio personalizado se configura por plantilla. Hay que repetirlo en cada tipo de correo.

## 4. Configuracion en Identity Platform / Google Cloud

### 4.1. Dominios autorizados

Plataforma:

```text
Google Cloud Console
```

URL directa:

```text
https://console.cloud.google.com/customer-identity/settings?project=etb-identity-omnicanal
```

Ruta:

```text
Menu > Identity Platform > Settings > Security > Authorized domains
```

Agregar, sin protocolo:

```text
idp.etb.com
notificaciones.etb.com
```

Agregar solo los dominios que realmente queden aprobados. Si el action handler productivo vive en otro dominio ETB, agregar tambien ese dominio.

### 4.2. API key / HTTP referrers

Plataforma:

```text
Google Cloud Console
```

URL directa:

```text
https://console.cloud.google.com/apis/credentials?project=etb-identity-omnicanal
```

Ruta:

```text
Menu > Google Auth Platform > Clients
```

Ruta equivalente:

```text
Menu > APIs & Services > Credentials
```

Pasos:

1. Abrir la API key usada por Firebase Web.
2. En `Application restrictions`, seleccionar `Websites`.
3. En `Website restrictions`, agregar:

```text
https://etb-identity-omnicanal.firebaseapp.com/*
https://etb-identity-omnicanal.web.app/*
https://idp.etb.com/*
https://notificaciones.etb.com/*
```

4. Agregar tambien el dominio productivo real del IdP si es distinto.
5. En `API restrictions`, mantener como minimo:
   - `Identity Toolkit API`
   - `Token Service API`
6. Guardar.

### 4.3. App Check / reCAPTCHA

URL dada por el usuario:

```text
https://console.firebase.google.com/u/0/project/etb-identity-omnicanal/appcheck
```

Los correos como tal no requieren App Check. Pero si el usuario abre un enlace del correo y aterriza en la SPA del IdP, el dominio de esa SPA debe estar contemplado en App Check / reCAPTCHA si el proyecto lo exige.

Validar:

1. Firebase Console > `App Check`.
2. Abrir la app web correspondiente.
3. Confirmar proveedor, normalmente reCAPTCHA Enterprise.
4. En Google Cloud, abrir:

```text
https://console.cloud.google.com/security/recaptcha?project=etb-identity-omnicanal
```

5. Abrir la site key usada por el IdP.
6. En dominios permitidos, agregar:

```text
idp.etb.com
```

7. No proteger rutas de imagen de email con App Check. Los clientes de correo no ejecutan la app ni envian tokens App Check.

## 5. Habilitar HTML en plantillas, si la consola no lo respeta

Identity Platform soporta `bodyFormat: HTML` en las plantillas. Si al enviar una prueba el correo muestra etiquetas HTML como texto, un administrador debe cambiar el formato por API.

No ejecutar esto sin tener permisos y sin validar en QA.

Comando:

```bash
PROJECT_ID="etb-identity-omnicanal"

curl -X PATCH \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=notification.sendEmail.verifyEmailTemplate.bodyFormat,notification.sendEmail.resetPasswordTemplate.bodyFormat,notification.sendEmail.changeEmailTemplate.bodyFormat,notification.sendEmail.revertSecondFactorAdditionTemplate.bodyFormat" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "projects/etb-identity-omnicanal/config",
    "notification": {
      "sendEmail": {
        "verifyEmailTemplate": { "bodyFormat": "HTML" },
        "resetPasswordTemplate": { "bodyFormat": "HTML" },
        "changeEmailTemplate": { "bodyFormat": "HTML" },
        "revertSecondFactorAdditionTemplate": { "bodyFormat": "HTML" }
      }
    }
  }'
```

No incluir `notification.sendEmail.method` ni `notification.sendEmail.smtp` en este cambio. La decision es conservar envio por Firebase/Google.

## 6. Action URL personalizada

Ruta en Firebase:

```text
Authentication > Templates > cualquier plantilla de correo > lapiz > Personalizar URL de accion
```

Firebase permite configurar una URL de accion personalizada para que los enlaces de administracion de cuenta vayan a un dominio propio.

Recomendacion:

```text
https://idp.etb.com/auth/action
```

La SPA ya maneja `resetPassword` en esta ruta con la linea visual del IdP. Si se amplian plantillas, el handler propio debe cubrir tambien estos modos:

```text
recoverEmail
verifyEmail
```

y leer estos parametros que Firebase anexa:

```text
mode
oobCode
apiKey
continueUrl
lang
```

Para `recoverEmail` y `verifyEmail`, usar primero el handler administrado por Firebase con dominio personalizado verificado hasta tener pruebas E2E especificas. No improvisar una ruta nueva sin pruebas de verificar correo y revertir cambio de correo.

## 7. Reglas de compatibilidad HTML email

Usar:

- Tablas para layout.
- CSS inline.
- Ancho maximo `600px`.
- Colores hex.
- Boton como `<a href="%LINK%">`.
- Texto de fallback con el link completo `%LINK%`.
- Imagenes absolutas `https://...`.

Evitar:

- `<script>`, formularios, iframes, video, canvas.
- CSS externo, clases dependientes de `<style>`, media queries obligatorias.
- SVG embebido o remoto como logo principal.
- Web fonts externas.
- Fondos con imagen como unico soporte visual.
- Imagenes con autenticacion, cookies, App Check o links temporales.

Variables soportadas relevantes:

```text
%APP_NAME%
%DISPLAY_NAME%
%EMAIL%
%NEW_EMAIL%
%LINK%
```

## 8. Valores para reemplazar antes de pegar

Antes de pegar las plantillas, reemplazar:

```text
{{LOGO_URL}}        -> URL PNG publica aprobada por Marca/CDN
{{HELP_URL}}        -> URL oficial de ayuda ETB
{{PRIVACY_URL}}     -> URL oficial de tratamiento de datos / privacidad ETB
{{SUPPORT_EMAIL}}   -> correo de soporte aprobado
```

Valores temporales sugeridos mientras las areas confirman:

```text
{{LOGO_URL}}      = https://idp.etb.com/branding/email/etb-logo-email.png
{{HELP_URL}}      = https://etb.com/
{{PRIVACY_URL}}   = https://etb.com/
{{SUPPORT_EMAIL}} = servicioalcliente@etb.com.co
```

## 9. Plantilla: verificacion de correo

Firebase Console:

```text
Authentication > Templates > Verificacion de direccion de correo electronico
```

Asunto:

```text
Verifica tu correo para acceder a Mi ETB
```

HTML:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Verifica tu correo</title>
  </head>
  <body style="margin:0; padding:0; background:#F8F9FB; font-family:Arial, Helvetica, sans-serif; color:#080707;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:#F8F9FB;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; background:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #e6eaf0;">
            <tr>
              <td style="background:#214780; padding:28px 32px 24px 32px;">
                <img src="{{LOGO_URL}}" width="112" alt="ETB" style="display:block; width:112px; max-width:112px; height:auto; border:0;">
                <p style="margin:22px 0 0 0; color:#ffffff; font-size:22px; line-height:28px; font-weight:bold;">Verifica tu correo y sigue conectado</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px 0; font-size:16px; line-height:24px;">Hola, %DISPLAY_NAME%:</p>
                <p style="margin:0 0 20px 0; font-size:16px; line-height:24px;">Para proteger tu cuenta de Mi ETB, confirma que este correo te pertenece.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
                  <tr>
                    <td bgcolor="#0092bc" style="border-radius:6px;">
                      <a href="%LINK%" style="display:inline-block; padding:14px 22px; color:#ffffff; font-size:16px; line-height:20px; font-weight:bold; text-decoration:none; border-radius:6px;">Verificar correo</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px 0; font-size:14px; line-height:22px; color:#515151;">Si el boton no funciona, copia y pega este enlace en tu navegador:</p>
                <p style="margin:0 0 24px 0; font-size:13px; line-height:20px; word-break:break-all;"><a href="%LINK%" style="color:#006ED0; text-decoration:underline;">%LINK%</a></p>
                <p style="margin:0; font-size:14px; line-height:22px; color:#515151;">Si no solicitaste esta verificacion, puedes ignorar este mensaje.</p>
              </td>
            </tr>
            <tr>
              <td style="background:#F8F9FB; padding:20px 32px; border-top:1px solid #e6eaf0;">
                <p style="margin:0 0 8px 0; font-size:12px; line-height:18px; color:#515151;">Este correo fue enviado por Firebase Authentication para ETB.</p>
                <p style="margin:0; font-size:12px; line-height:18px; color:#515151;">Ayuda: <a href="{{HELP_URL}}" style="color:#006ED0;">{{HELP_URL}}</a> · Privacidad: <a href="{{PRIVACY_URL}}" style="color:#006ED0;">{{PRIVACY_URL}}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## 10. Plantilla: restablecer contrasena

Firebase Console:

```text
Authentication > Templates > Restablecer contrasena
```

Asunto:

```text
Restablece tu contrasena de Mi ETB
```

HTML:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Restablece tu contrasena</title>
  </head>
  <body style="margin:0; padding:0; background:#F8F9FB; font-family:Arial, Helvetica, sans-serif; color:#080707;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:#F8F9FB;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; background:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #e6eaf0;">
            <tr>
              <td style="background:#004c8f; padding:28px 32px 24px 32px;">
                <img src="{{LOGO_URL}}" width="112" alt="ETB" style="display:block; width:112px; max-width:112px; height:auto; border:0;">
                <p style="margin:22px 0 0 0; color:#ffffff; font-size:22px; line-height:28px; font-weight:bold;">Crea una nueva contrasena segura</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px 0; font-size:16px; line-height:24px;">Hola, %DISPLAY_NAME%:</p>
                <p style="margin:0 0 20px 0; font-size:16px; line-height:24px;">Recibimos una solicitud para restablecer la contrasena asociada a %EMAIL%.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
                  <tr>
                    <td bgcolor="#0092bc" style="border-radius:6px;">
                      <a href="%LINK%" style="display:inline-block; padding:14px 22px; color:#ffffff; font-size:16px; line-height:20px; font-weight:bold; text-decoration:none; border-radius:6px;">Restablecer contrasena</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px 0; font-size:14px; line-height:22px; color:#515151;">Por seguridad, usa este enlace solo si hiciste la solicitud. Si no fuiste tu, ignora este correo y conserva tu contrasena actual.</p>
                <p style="margin:0 0 16px 0; font-size:14px; line-height:22px; color:#515151;">Si el boton no funciona, copia y pega este enlace en tu navegador:</p>
                <p style="margin:0; font-size:13px; line-height:20px; word-break:break-all;"><a href="%LINK%" style="color:#006ED0; text-decoration:underline;">%LINK%</a></p>
              </td>
            </tr>
            <tr>
              <td style="background:#F8F9FB; padding:20px 32px; border-top:1px solid #e6eaf0;">
                <p style="margin:0 0 8px 0; font-size:12px; line-height:18px; color:#515151;">ETB nunca te pedira tu contrasena por correo, llamada o mensaje.</p>
                <p style="margin:0; font-size:12px; line-height:18px; color:#515151;">Ayuda: <a href="{{HELP_URL}}" style="color:#006ED0;">{{HELP_URL}}</a> · Contacto: <a href="mailto:{{SUPPORT_EMAIL}}" style="color:#006ED0;">{{SUPPORT_EMAIL}}</a></p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## 11. Plantilla: cambio de correo

Firebase Console:

```text
Authentication > Templates > Cambio de direccion de correo electronico
```

Asunto:

```text
Cambio de correo en tu cuenta Mi ETB
```

HTML:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Cambio de correo</title>
  </head>
  <body style="margin:0; padding:0; background:#F8F9FB; font-family:Arial, Helvetica, sans-serif; color:#080707;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:#F8F9FB;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; background:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #e6eaf0;">
            <tr>
              <td style="background:#214780; padding:28px 32px 24px 32px;">
                <img src="{{LOGO_URL}}" width="112" alt="ETB" style="display:block; width:112px; max-width:112px; height:auto; border:0;">
                <p style="margin:22px 0 0 0; color:#ffffff; font-size:22px; line-height:28px; font-weight:bold;">Revisa el cambio de correo de tu cuenta</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px 0; font-size:16px; line-height:24px;">Hola, %DISPLAY_NAME%:</p>
                <p style="margin:0 0 16px 0; font-size:16px; line-height:24px;">Se registro un cambio de correo en tu cuenta de Mi ETB.</p>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="margin:20px 0; background:#F8F9FB; border:1px solid #e6eaf0; border-radius:6px;">
                  <tr>
                    <td style="padding:16px;">
                      <p style="margin:0 0 8px 0; font-size:14px; line-height:20px; color:#515151;">Correo anterior</p>
                      <p style="margin:0 0 14px 0; font-size:15px; line-height:22px; color:#080707;">%EMAIL%</p>
                      <p style="margin:0 0 8px 0; font-size:14px; line-height:20px; color:#515151;">Nuevo correo</p>
                      <p style="margin:0; font-size:15px; line-height:22px; color:#080707;">%NEW_EMAIL%</p>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 20px 0; font-size:16px; line-height:24px;">Si reconoces este cambio, no necesitas hacer nada. Si no fuiste tu, usa el enlace para revisar y proteger tu cuenta.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
                  <tr>
                    <td bgcolor="#0092bc" style="border-radius:6px;">
                      <a href="%LINK%" style="display:inline-block; padding:14px 22px; color:#ffffff; font-size:16px; line-height:20px; font-weight:bold; text-decoration:none; border-radius:6px;">Revisar cambio</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px 0; font-size:14px; line-height:22px; color:#515151;">Si el boton no funciona, copia y pega este enlace en tu navegador:</p>
                <p style="margin:0; font-size:13px; line-height:20px; word-break:break-all;"><a href="%LINK%" style="color:#006ED0; text-decoration:underline;">%LINK%</a></p>
              </td>
            </tr>
            <tr>
              <td style="background:#F8F9FB; padding:20px 32px; border-top:1px solid #e6eaf0;">
                <p style="margin:0; font-size:12px; line-height:18px; color:#515151;">Si necesitas ayuda, contacta a ETB en <a href="mailto:{{SUPPORT_EMAIL}}" style="color:#006ED0;">{{SUPPORT_EMAIL}}</a>.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## 12. Plantilla: segundo factor / MFA

Firebase Console:

```text
Authentication > Templates > Notificacion sobre la inscripcion de segundo factor
```

Asunto:

```text
Se agrego una verificacion adicional a tu cuenta Mi ETB
```

HTML:

```html
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Verificacion adicional agregada</title>
  </head>
  <body style="margin:0; padding:0; background:#F8F9FB; font-family:Arial, Helvetica, sans-serif; color:#080707;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%; background:#F8F9FB;">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%; max-width:600px; background:#ffffff; border-radius:8px; overflow:hidden; border:1px solid #e6eaf0;">
            <tr>
              <td style="background:#004c8f; padding:28px 32px 24px 32px;">
                <img src="{{LOGO_URL}}" width="112" alt="ETB" style="display:block; width:112px; max-width:112px; height:auto; border:0;">
                <p style="margin:22px 0 0 0; color:#ffffff; font-size:22px; line-height:28px; font-weight:bold;">Tu cuenta tiene una nueva capa de seguridad</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px;">
                <p style="margin:0 0 16px 0; font-size:16px; line-height:24px;">Hola, %DISPLAY_NAME%:</p>
                <p style="margin:0 0 20px 0; font-size:16px; line-height:24px;">Se agrego una verificacion adicional a tu cuenta de Mi ETB.</p>
                <p style="margin:0 0 20px 0; font-size:16px; line-height:24px;">Si realizaste esta accion, no necesitas hacer nada. Si no reconoces este cambio, revisa tu cuenta de inmediato.</p>
                <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin:28px 0;">
                  <tr>
                    <td bgcolor="#0092bc" style="border-radius:6px;">
                      <a href="%LINK%" style="display:inline-block; padding:14px 22px; color:#ffffff; font-size:16px; line-height:20px; font-weight:bold; text-decoration:none; border-radius:6px;">Proteger mi cuenta</a>
                    </td>
                  </tr>
                </table>
                <p style="margin:0 0 16px 0; font-size:14px; line-height:22px; color:#515151;">Si el boton no funciona, copia y pega este enlace en tu navegador:</p>
                <p style="margin:0; font-size:13px; line-height:20px; word-break:break-all;"><a href="%LINK%" style="color:#006ED0; text-decoration:underline;">%LINK%</a></p>
              </td>
            </tr>
            <tr>
              <td style="background:#F8F9FB; padding:20px 32px; border-top:1px solid #e6eaf0;">
                <p style="margin:0; font-size:12px; line-height:18px; color:#515151;">Por seguridad, ETB no solicita codigos, contrasenas ni datos sensibles por correo.</p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## 13. SMS de verificacion

Firebase Console:

```text
Authentication > Templates > Verificacion por SMS
```

El SMS no soporta HTML. Si la consola permite editar texto, usar algo breve:

```text
%LOGIN_CODE% es tu codigo de verificacion para Mi ETB. No lo compartas con nadie.
```

Si aparece solo lectura, no hay cambio operativo que hacer desde la consola.

## 14. Pruebas obligatorias antes de produccion

Probar minimo en QA:

1. Gmail web y app movil.
2. Outlook web y escritorio.
3. Apple Mail iOS.
4. Un correo corporativo ETB.
5. Verificacion de correo.
6. Restablecimiento de contrasena.
7. Cambio/reversion de correo.
8. MFA si esta habilitado.
9. Carga de logo desde red externa, no VPN.
10. Enlaces abriendo desde movil y desktop.

Criterios de aceptacion:

- El remitente muestra ETB y dominio ETB.
- El enlace principal usa dominio ETB o dominio aprobado.
- El correo no muestra HTML como texto.
- El logo carga.
- El link `%LINK%` funciona y completa la accion.
- El correo no cae en spam en pruebas basicas.
- No se uso SMTP corporativo.

## 15. Correos listos para enviar

### 15.1. Correo a DNS / dominios

Asunto:

```text
Solicitud DNS para dominio de correos de autenticacion Firebase - ETB IdP
```

Cuerpo:

```text
Hola equipo,

Necesitamos configurar un dominio ETB para los correos transaccionales de autenticacion del proyecto Firebase / Google Cloud Identity Platform `etb-identity-omnicanal`.

Contexto:
- Los correos seguiran saliendo desde Firebase / Google, no desde SMTP corporativo.
- Necesitamos que el usuario vea remitente y enlaces con dominio ETB.
- Dominio recomendado para esta funcion: `idp.etb.com`.
- Alternativas si gobierno DNS lo prefiere: `notificaciones.etb.com`, `cuentas.etb.com` o `auth.etb.com`.

Accion requerida:
1. Validar y aprobar el subdominio que usaremos.
2. Una vez lo ingresemos en Firebase Console > Authentication > Templates > Personalizar dominio, Firebase mostrara registros DNS de verificacion.
3. Les enviaremos esos registros exactos para creacion. Normalmente seran TXT y CNAME; si aparece SPF, debe revisarse que no existan dos registros `v=spf1` para el mismo nombre.
4. Crear los registros con TTL inicial sugerido de 300 segundos mientras se valida.
5. Confirmarnos cuando esten publicados para que podamos completar la verificacion en Firebase.

Importante:
- No se deben borrar registros actuales de ETB.
- Si el dominio final fuera `etb.com` raiz, requerimos revision especial porque puede impactar SPF/DMARC corporativo.
- La verificacion en Firebase puede tardar hasta 24 horas despues de publicados los registros.

Quedamos atentos a la aprobacion del subdominio y al responsable para coordinar la ventana de cambio.

Gracias.
```

### 15.2. Correo a Seguridad / Gobierno de correo

Asunto:

```text
Aprobacion de dominio remitente ETB para correos Firebase Authentication
```

Cuerpo:

```text
Hola equipo,

Solicitamos aprobacion de seguridad/correo para usar un dominio ETB en los correos transaccionales de autenticacion del IdP `etb-identity-omnicanal`.

Alcance:
- Plataforma emisora: Firebase Authentication / Google Cloud Identity Platform.
- Metodo de envio: DEFAULT de Google/Firebase.
- No se solicita configurar SMTP corporativo ni entregar credenciales SMTP.
- Tipo de correos: verificacion de correo, restablecimiento de contrasena, cambio de correo y notificacion de segundo factor si aplica.

Propuesta:
- Nombre remitente: `ETB - Mi ETB`.
- Local-part: `noreply`.
- Dominio recomendado: `idp.etb.com` o `notificaciones.etb.com`.
- Remitente esperado: `noreply@idp.etb.com` o `noreply@notificaciones.etb.com`.
- Reply-To sugerido: `servicioalcliente@etb.com.co` o el buzon que ustedes aprueben.

Validaciones solicitadas:
1. Aprobar el dominio/subdominio remitente.
2. Revisar implicaciones SPF, DKIM y DMARC de los registros que Firebase solicite.
3. Confirmar si el dominio raiz `etb.com` esta permitido o si debemos usar subdominio dedicado.
4. Confirmar el correo `Reply-To` autorizado.
5. Confirmar si se requiere disclaimer legal adicional en el pie del correo.

Restricciones de seguridad que mantendremos:
- No se pediran contrasenas, codigos OTP ni datos sensibles por correo.
- Los enlaces de accion seran generados por Firebase con codigos OOB de un solo uso.
- No usaremos imagenes con tracking individual ni parametros sensibles.
- No se usara proveedor SMTP externo.

Gracias por confirmarnos aprobacion o ajustes requeridos.
```

### 15.3. Correo a Marca / Comunicaciones

Asunto:

```text
Aprobacion de plantillas de correo transaccional Mi ETB - Firebase Auth
```

Cuerpo:

```text
Hola equipo,

Necesitamos su aprobacion de marca y copy para las plantillas de correo transaccional del IdP Mi ETB en Firebase Authentication.

Contexto:
- Son correos de seguridad/autenticacion, no campanas comerciales.
- Eventos: verificar correo, restablecer contrasena, cambio de correo y segundo factor si aplica.
- El tono propuesto es cercano, claro y funcional, alineado con Mi ETB.
- Usaremos paleta de la aplicacion:
  - Azul profundo: #214780
  - Azul ETB: #004c8f
  - Azul interaccion: #0092bc
  - Fondo: #F8F9FB
  - Texto principal: #080707
  - Texto secundario: #515151

Necesitamos de ustedes:
1. Logo ETB aprobado para email en PNG, preferiblemente transparente o version apta para fondo azul.
2. URL publica final del logo en CDN/hosting ETB, por ejemplo:
   `https://cdn.etb.com/idp/email/etb-logo-email.png`
3. Confirmacion de si el remitente visible debe ser:
   - `ETB`
   - `ETB - Mi ETB`
   - otro texto aprobado.
4. URL oficial de ayuda que debe ir en el pie.
5. URL oficial de privacidad/tratamiento de datos que debe ir en el pie.
6. Aprobacion o ajustes de estos asuntos:
   - `Verifica tu correo para acceder a Mi ETB`
   - `Restablece tu contrasena de Mi ETB`
   - `Cambio de correo en tu cuenta Mi ETB`
   - `Se agrego una verificacion adicional a tu cuenta Mi ETB`

Restricciones tecnicas del canal email:
- No usaremos fuentes externas porque muchos clientes de correo las bloquean.
- No usaremos SVG como logo principal; necesitamos PNG para mayor compatibilidad.
- El diseno debe ir con estilos inline y tablas para soportar Gmail, Outlook, Apple Mail y clientes moviles.
- No se incluiran animaciones, videos, formularios ni scripts.

Quedamos atentos a los activos y aprobaciones para cargar las plantillas en Firebase.
```

### 15.4. Correo a CDN / Web

Asunto:

```text
Publicacion de activos ETB para plantillas de correo del IdP
```

Cuerpo:

```text
Hola equipo,

Necesitamos publicar los activos de marca para las plantillas de correo transaccional del IdP Mi ETB.

Activo requerido:
- Logo ETB para email.
- Formato: PNG.
- Ancho visual sugerido: 96 a 120 px.
- Version 2x recomendada para pantallas retina.
- Peso ideal: menor a 80 KB.

URL sugerida:
`https://cdn.etb.com/idp/email/etb-logo-email.png`

Requisitos tecnicos:
1. HTTPS publico con certificado valido.
2. Sin autenticacion, VPN, cookies, tokens firmados ni URLs con expiracion.
3. Sin App Check.
4. Sin restriccion por referer, porque Gmail/Outlook/Apple/Yahoo pueden cargar imagenes mediante proxies.
5. `Content-Type: image/png`.
6. Cache publico permitido.
7. Disponible desde redes externas a ETB.

Por favor confirmar la URL final publicada y si existe alguna politica CDN que pueda bloquear clientes de correo.

Gracias.
```

### 15.5. Correo a administradores GCP/Firebase

Asunto:

```text
Configuracion Firebase Auth Templates con dominio y HTML ETB
```

Cuerpo:

```text
Hola equipo,

Solicitamos apoyo para configurar las plantillas de correo de Firebase Authentication / Identity Platform en el proyecto:

`etb-identity-omnicanal`

URL:
`https://console.firebase.google.com/u/0/project/etb-identity-omnicanal/authentication/emails`

Acciones requeridas:

1. Abrir Firebase Console > Authentication > Templates.
2. Confirmar que se esta editando el tenant/usuario correcto. En la pantalla actual aparece `Usuario predeterminado`.
3. Para cada plantilla:
   - Verificacion de direccion de correo electronico
   - Restablecer contrasena
   - Cambio de direccion de correo electronico
   - Notificacion sobre inscripcion de segundo factor, si aplica
4. Configurar:
   - Nombre del remitente: `ETB - Mi ETB`
   - De/local-part: `noreply`
   - Reply-To: pendiente de confirmacion por Seguridad, sugerido `servicioalcliente@etb.com.co`
   - Asunto y cuerpo HTML segun plantilla aprobada por Marca.
5. En `Personalizar dominio`, ingresar el dominio aprobado, inicialmente propuesto: `idp.etb.com`.
6. Copiar los registros DNS que Firebase solicite y enviarlos a DNS.
7. Cuando la verificacion termine, aplicar el dominio personalizado.
8. No configurar `Configuracion del SMTP`; el envio debe permanecer por Firebase/Google.

Si al probar el correo el HTML aparece como texto plano, se debe habilitar `bodyFormat: HTML` por Identity Toolkit Admin API para estas plantillas:
- verifyEmailTemplate
- resetPasswordTemplate
- changeEmailTemplate
- revertSecondFactorAdditionTemplate

Comando de referencia:

PROJECT_ID="etb-identity-omnicanal"

curl -X PATCH \
  "https://identitytoolkit.googleapis.com/admin/v2/projects/${PROJECT_ID}/config?updateMask=notification.sendEmail.verifyEmailTemplate.bodyFormat,notification.sendEmail.resetPasswordTemplate.bodyFormat,notification.sendEmail.changeEmailTemplate.bodyFormat,notification.sendEmail.revertSecondFactorAdditionTemplate.bodyFormat" \
  -H "Authorization: Bearer $(gcloud auth print-access-token)" \
  -H "Content-Type: application/json" \
  --data '{
    "name": "projects/etb-identity-omnicanal/config",
    "notification": {
      "sendEmail": {
        "verifyEmailTemplate": { "bodyFormat": "HTML" },
        "resetPasswordTemplate": { "bodyFormat": "HTML" },
        "changeEmailTemplate": { "bodyFormat": "HTML" },
        "revertSecondFactorAdditionTemplate": { "bodyFormat": "HTML" }
      }
    }
  }'

Tambien validar:
- Identity Platform > Settings > Security > Authorized domains: agregar el dominio final sin protocolo.
- API key web: agregar `https://idp.etb.com/*` en HTTP referrers si ese dominio ejecutara el action handler.
- App Check / reCAPTCHA: agregar el dominio final si la SPA IdP lo requiere.

Gracias.
```

## 16. Fuentes de referencia

- Firebase: custom domain para correos de Authentication: `https://firebase.google.com/docs/auth/email-custom-domain`
- Firebase: custom email action handlers: `https://firebase.google.com/docs/auth/custom-email-handler`
- Firebase Help: personalizar correos de administracion de cuenta: `https://support.google.com/firebase/answer/7000714?hl=es-419`
- Identity Platform REST Config: `https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/Config`
- Identity Platform updateConfig: `https://docs.cloud.google.com/identity-platform/docs/reference/rest/v2/projects/updateConfig`
- Branding ETB repo: `docs/guides/BRANDING_ETB.md`
- Activos ETB repo: `docs/guides/BRAND_ASSETS.md`
