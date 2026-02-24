# Verifiable Digital Credentials (VDC) Challenge Integration POC

## Overview

This document describes the implementation of Verifiable Digital Credentials (VDC) challenge integration in the Okta Sign-In Widget as a proof of concept.
This feature enables users to verify their identity using digital credentials stored in mobile wallets (e.g., mobile driver's license) during password reset or account recovery flows.

## Caveats

This proof of concept has the following limitations:

- **Widget Version**: This implementation only supports **v3** of the Okta Sign-In Widget. It has not been tested or implemented for v2 or earlier versions.
- **OIE Requirement**: This feature requires an **OIE (Okta Identity Engine) enabled** Okta Organization. Classic Engine organizations are not supported.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     User Initiates Password Recovery             │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Okta IDX API                                │
│  POST /idp/idx/recover                                           │
│  Returns: verifiable-credential-challenge remediation            │
│           - presentation definition (OpenID4VP)                  │
│           - DCQL query for requested claims                      │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Sign-In Widget (Frontend)                      │
│  1. Transformer converts IDX response → UI schema                │
│  2. Renders "Continue" button                                    │
│  3. User clicks button                                           │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│              Digital Credentials API (Browser)                   │
│  navigator.credentials.get({ digital: { ... } })                │
│  Routes request to compatible wallet app                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Mobile Wallet App                             │
│  1. Receives OpenID4VP request                                   │
│  2. User reviews requested claims                                │
│  3. User authorizes sharing                                      │
│  4. Wallet signs response with device key                        │
│  5. Returns signed VP token                                      │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Sign-In Widget (Frontend)                      │
│  POST /idp/idx/challenge/answer                                  │
│  Body: { presentation, credentials.vdcAuthorizationResponse }    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Okta IDX API -> VDC service                 │
│  1. Validates signed credentials                                 │
│  2. Verifies cryptographic signatures                            │
│  3. Returns success response                                     │
│  4. User proceeds to password reset                              │
└─────────────────────────────────────────────────────────────────┘
```

## Technical Flow Sequence

### 1. Password Recovery Initiation

User enters their username and selects "Forgot Password":
```
POST /idp/idx/recover
```

### 2. VDC Challenge Presentation

IDX API returns a `verifiable-credential-challenge` remediation containing:
- OpenID4VP presentation definition
- DCQL query specifying requested claims
- Session state (nonce, sessionId)

Example response structure (simplified):
```json
{
  "remediation": {
    "value": [
      {
        "name": "verifiable-credential-challenge",
        "value": [
          {
            "name": "presentation",
            "value": {
              "responseMode": "dc_api.jwt",
              "requests": [
                {
                  "protocol": "openid4vp-v1-signed",
                  "data": { "request": "<signed-jwt>" }
                }
              ]
            }
          }
        ]
      }
    ]
  }
}
```

### 3. Widget Transformation

The transformer (`transformVerifiableCredentialChallenge`) converts the IDX response into UI elements:
- Title: "Reset your [brandName] password"
- Description: "To continue, we need to verify your identity with your mobile driver's license."
- DigitalCredentialsButton component
- Instructions text

### 4. Digital Credentials API Invocation

When user clicks "Continue", the `DigitalCredentialsButton` component calls:

```typescript
const signedCredentialResponse = await navigator.credentials.get({
  mediation: 'required',
  digital: {
    requests: presentationDefinition.requests
  }
});
```

The browser/OS routes this request via a scannable QR code (x-device) or directly (same device) to a compatible wallet app.

### 5. Wallet Processing

The wallet app:
1. Decodes the signed JWT request
2. Displays requested claims to the user (e.g., name, date of birth, age_over_21)
3. User authorizes sharing credentials
4. Wallet creates a signed response using the device's private key
5. Returns encrypted VP token to the browser

### 6. Response Submission

The widget submits the signed response (encrypted VP token) back to Okta:

```typescript
POST /idp/idx/challenge/answer
{
  "stateHandle": "...",
  "presentation": { /* original presentation def */ },
  "credentials": {
    "vdcAuthorizationResponse": "<signed-vp-token-from-wallet>"
  }
}
```

### 7. Verification & Success

Okta uses the VDC service integration to:
1. Validate the JWT signature
2. Verify the credential authenticity
3. Retrieve verified claims attached to the credential

Okta:
1. Checks the claimed identity matches the user
2. Returns success response so that the idx pipeline can continue


## Implementation Details

### Core Components

#### 1. Transformer: `transformVerifiableCredentialChallenge`

**File**: `src/v3/src/transformer/vdc/transformVerifiableCredentialChallenge.ts:25-77`

**Purpose**: Converts IDX API response into UI schema elements for rendering.

**Key Logic**:
```typescript
export const transformVerifiableCredentialChallenge: IdxStepTransformer = ({
  transaction,
  formBag,
  widgetProps,
}) => {
  // Find the verifiable-credential-challenge remediation
  const remediation = transaction.neededToProceed?.find(
    (r) => r.name === 'verifiable-credential-challenge'
  );

  // Extract presentation definition from remediation
  const presentationData = remediation?.value?.find(
    (val) => val.name === 'presentation'
  )?.value;

  // Create UI elements
  uischema.elements = [
    titleElement,           // "Reset your password"
    descriptionElement,     // Verification message
    initiateRequestButton,  // DigitalCredentialsButton with presentation def
    instructionsElement,    // Usage instructions
  ];

  return formBag;
};
```

**What it does**:
- Extracts the `presentation` object from the IDX remediation response
- Creates a title element with optional brand name
- Creates description text explaining the verification requirement
- Creates the `DigitalCredentialsButton` element with the presentation definition
- Adds instructional text for users

#### 2. React Component: `DigitalCredentialsButton`

**File**: `src/v3/src/components/DigitalCredentialsButton/DigitalCredentialsButton.tsx:18-59`

**Purpose**: Triggers the Digital Credentials API and submits the response to Okta.

**Key Logic**:
```typescript
const DigitalCredentialsButton: UISchemaElementComponent = ({ uischema }) => {
  const { presentationDefinition } = uischema.options;
  const onSubmitHandler = useOnSubmit();

  const handleClick = async () => {
    if (presentationDefinition) {
      // Call Digital Credentials API
      const signedCredentialResponse = await navigator.credentials.get({
        mediation: 'required',
        digital: { requests: presentationDefinition.requests },
      });

      // Submit to Okta
      await onSubmitHandler({
        step: 'verifiable-credential-challenge',
        params: {
          presentation: { ...presentationDefinition },
          credentials: {
            vdcAuthorizationResponse: signedCredentialResponse.data.response,
          },
        },
      });
    }
  };

  return (
    <OdyButton
      variant="primary"
      isFullWidth
      onClick={handleClick}
      label="Continue"
    />
  );
};
```

**What it does**:
- Renders a primary action button labeled "Continue"
- On click, invokes `navigator.credentials.get()` with the presentation definition
- Waits for the wallet to return a signed credential response
- Submits the original presentation definition and signed response to `/idp/idx/challenge/answer`

#### 3. IDX Constants

**File**: `src/v3/src/constants/idxConstants.ts:94`

Added new step constant:
```typescript
export const IDX_STEP: Record<string, string> = {
  // ... other steps
  VERIFIABLE_CREDENTIAL_CHALLENGE: 'verifiable-credential-challenge',
};
```

#### 4. Transformer Registration

**File**: `src/v3/src/transformer/layout/idxTransformerMapping.ts:587-594`

Maps the VDC challenge step to its transformer:
```typescript
[IDX_STEP.VERIFIABLE_CREDENTIAL_CHALLENGE]: {
  [AUTHENTICATOR_KEY.DEFAULT]: {
    transform: transformVerifiableCredentialChallenge,
    buttonConfig: {
      showDefaultSubmit: false,  // Hide default submit button
      showDefaultCancel: true,  // Show default cancel button
    },
  },
},
```

**Note**: Default submit button is hidden because the `DigitalCredentialsButton` handles submission.

#### 5. Component Registration

**File**: `src/v3/src/components/Form/renderers.tsx:250-252`

Registers the component renderer:
```typescript
{
  tester: ({ type }) => type === 'DigitalCredentialsButton',
  renderer: DigitalCredentialsButton,
}
```

#### 6. TypeScript Interfaces

**File**: `src/v3/src/types/schema.ts:759-764`

Defines the element interface:
```typescript
export interface DigitalCredentialsButtonElement extends UISchemaElement {
  type: 'DigitalCredentialsButton';
  translations?: TranslationInfo[];
  options: {
    presentationDefinition: any;
  };
}
```

## Code Changes Summary

### Files Added (8 new files)

1. **`src/v3/src/components/DigitalCredentialsButton/DigitalCredentialsButton.tsx`**
   - Main UI component that triggers Digital Credentials API
   - Handles button click and credential response submission

2. **`src/v3/src/components/DigitalCredentialsButton/index.tsx`**
   - Component export file

3. **`src/v3/src/transformer/vdc/index.ts`**
   - Transformer module export

4. **`src/v3/src/transformer/vdc/transformVerifiableCredentialChallenge.ts`**
   - Core transformer logic for converting IDX response to UI schema

5. **`src/v3/src/transformer/vdc/transformVerifiableCredentialChallenge.test.ts`**
   - Unit tests for transformer

6. **`src/v3/src/mocks/response/idp/idx/introspect/verifiable-credential-challenge.json`**
   - Mock IDX API response for testing

7. **`src/v3/src/mocks/scenario/verifiable-credential-challenge.ts`**
   - Complete test scenario with mocked endpoints

8. **Documentation updates**

### Files Modified (6 files)

1. **`src/v3/src/components/Form/renderers.tsx`**
   - Added DigitalCredentialsButton component renderer
   - Line 31: Import statement
   - Lines 250-252: Renderer registration

2. **`src/v3/src/constants/idxConstants.ts`**
   - Line 94: Added `VERIFIABLE_CREDENTIAL_CHALLENGE` step constant

3. **`src/v3/src/transformer/layout/idxTransformerMapping.ts`**
   - Lines 587-594: Mapped transformer to VDC challenge step

4. **`src/v3/src/types/schema.ts`**
   - Lines 759-764: Added `DigitalCredentialsButtonElement` interface

5. **`src/v3/src/mocks/scenario/index.ts`**
   - Registered verifiable-credential-challenge test scenario

6. **`polyfill/README.md`**
   - Version updates

## Testing & Verification

### Mock Scenario

**File**: `src/v3/src/mocks/scenario/verifiable-credential-challenge.ts:17-95`

The mock scenario provides a complete end-to-end flow for testing:

```typescript
scenario('verifiable-credential-challenge', (rest) => {
  return [
    // Bootstrap endpoints
    rest.get('*/oauth2/default/.well-known/openid-configuration', ...),
    rest.post('*/oauth2/default/v1/interact', ...),

    // Identity flow
    rest.post('*/idp/idx/introspect', ...),  // Returns identify screen
    rest.post('*/idp/idx/identify', ...),    // Returns after username entry

    // Recovery flow returns VDC challenge
    rest.post('*/idp/idx/recover', async (req, res, ctx) => {
      const { default: body } = await import(
        '../response/idp/idx/introspect/verifiable-credential-challenge.json'
      );
      return res(ctx.status(200), ctx.json(body));
    }),

    // Answer endpoint simulates successful verification
    rest.post('*/idp/idx/challenge/answer', async (req, res, ctx) => {
      const { default: body } = await import('../response/idp/idx/consent/success.json');
      return res(ctx.status(200), ctx.json(body));
    }),

    // Cancel endpoint
    rest.post('*/idp/idx/cancel', ...),
  ];
});
```

### Manual Testing

To test the VDC challenge flow manually:

1. **Start development server with mock scenario:**
   ```bash
   npm start -- --scenario verifiable-credential-challenge
   ```

2. **Navigate to the widget** in your browser

3. **Trigger password recovery:**
   - Enter a username (any value works with mocks)
   - Click "Forgot Password" or similar link
   - Click "Verify with Email" (or configured option)

4. **Verify VDC challenge screen:**
   - Should display title: "Reset your password"
   - Should show description about mobile driver's license verification
   - Should show "Continue" button
   - Should show instructions about digital wallet apps

5. **Test Digital Credentials API:**
   - Click "Continue" button
   - Browser should attempt to invoke `navigator.credentials.get()`
   - **Note**: Most browsers require real wallet integration; mocking may be needed

6. **Verify flow completion:**
   - After credential response (or mock), should proceed to success screen

### Unit Tests

**File**: `src/v3/src/transformer/vdc/transformVerifiableCredentialChallenge.test.ts`

Tests cover:
- UI element generation from IDX response
- Extraction of presentation definition
- Title generation with/without brand name
- Proper structure of UI schema elements

Example test structure:
```typescript
describe('transformVerifiableCredentialChallenge', () => {
  it('should create correct UI elements', () => {
    const result = transformVerifiableCredentialChallenge({
      transaction,
      formBag,
      widgetProps,
    });

    expect(result.uischema.elements).toHaveLength(4);
    expect(result.uischema.elements[0].type).toBe('Title');
    expect(result.uischema.elements[2].type).toBe('DigitalCredentialsButton');
  });
});
```

## Browser Compatibility

### Digital Credentials API Support

The Digital Credentials API is an experimental web platform feature with limited support:

**Current Support (as of 2025)**:
- **Chrome/Edge**: Available behind experimental flag
  - Enable via `chrome://flags/#enable-experimental-web-platform-features`
- **Safari**: Partial support with compatible wallet apps (e.g., Apple Wallet)
- **Firefox**: Not yet supported
- **Mobile Browsers**: Limited support, varies by platform and wallet

### Known Issues

1. **TypeScript Types**: Digital Credentials API not in standard TypeScript types
   - Workaround: Type assertions (`@ts-expect-error`) used in code

2. **Testing Challenges**: Difficult to test without real wallet integration
   - Workaround: Mock scenario simulates API responses

3. **Error Handling**: Limited error information from Digital Credentials API
   - User cancellation, timeout, and errors all handled generically

## Integration Endpoints

### IDX API Endpoints

**Password Recovery Initiation**:
```
POST /idp/idx/recover
Content-Type: application/json

{
  "stateHandle": "<state-token>"
}
```

**Response** (VDC Challenge):
```json
{
  "version": "1.0.0",
  "stateHandle": "<state-token>",
  "remediation": {
    "value": [
      {
        "name": "verifiable-credential-challenge",
        "href": "/idp/idx/challenge/answer",
        "method": "POST",
        "value": [
          {
            "name": "presentation",
            "value": {
              "responseMode": "dc_api.jwt",
              "requests": [...]
            }
          }
        ]
      }
    ]
  }
}
```

**Submit Credential Response**:
```
POST /idp/idx/challenge/answer
Content-Type: application/json

{
  "stateHandle": "<state-token>",
  "presentation": {
    "responseMode": "dc_api.jwt",
    "requests": [...],
    "state": {
      "nonce": "...",
      "sessionId": "..."
    }
  },
  "credentials": {
    "vdcAuthorizationResponse": "<signed-vp-token-from-wallet>"
  }
}
```

**Success Response**:
```json
{
  "version": "1.0.0",
  "stateHandle": "<new-state-token>",
  "status": "SUCCESS",
  // ... proceed to password reset
}
```

## Developer Setup

### Prerequisites

- Node.js 14+ and npm
- Okta Sign-In Widget source code
- Compatible browser with Digital Credentials API support (or mocks)

### Local Development

1. **Clone and install**:
   ```bash
   git clone <repo-url>
   cd okta-signin-widget
   npm install
   ```

2. **Start with VDC scenario**:
   ```bash
   npm start -- --scenario verifiable-credential-challenge
   ```

3. **Navigate to** `http://localhost:3000`

4. **Test the flow**:
   - Enter any username
   - Click "Forgot Password"
   - Observe VDC challenge screen

### Testing Without Real Wallet

Since most developers won't have compatible wallets:

1. **Use Mock Scenario**: The provided mock automatically returns success
2. **Mock Digital Credentials API**: Intercept `navigator.credentials.get()` calls

Example mock:
```typescript
// Mock the Digital Credentials API
navigator.credentials.get = async (options) => {
  return {
    type: 'digital',
    data: {
      protocol: 'openid4vp-v1-signed',
      response: '<mock-vp-token-response>'
    }
  };
};
```

## Summary

The VDC Challenge integration enables passwordless identity verification using digital credentials stored in mobile wallets. The implementation follows these principles:

1. **Standards-Based**: Uses OpenID4VP, DCQL, and ISO standards
2. **Privacy-Preserving**: Selective disclosure with user consent
3. **Secure**: End-to-end encryption and cryptographic signatures
4. **Progressive**: Gracefully degrades for unsupported browsers
5. **Modular**: Clean separation between transformer, component, and API layers

The integration consists of:
- **Transformer**: Converts IDX response to UI schema
- **Component**: Triggers Digital Credentials API
- **Mock Scenario**: Enables local testing
- **Type Definitions**: TypeScript interfaces for type safety

