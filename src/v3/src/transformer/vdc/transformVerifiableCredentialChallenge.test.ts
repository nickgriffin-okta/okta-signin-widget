/*
 * Copyright (c) 2022-present, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */

import { IdxTransaction } from '@okta/okta-auth-js';

import { FormBag, UISchemaLayoutType, WidgetProps } from '../../types';
import { transformVerifiableCredentialChallenge } from './transformVerifiableCredentialChallenge';

describe('Verifiable Credential Challenge Transformer Tests', () => {
  let transaction: IdxTransaction;
  let widgetProps: WidgetProps;
  let formBag: FormBag;

  beforeEach(() => {
    transaction = {
      context: {
        currentAuthenticator: {
          value: {
            contextualData: {
              qrcode: {
                href: 'data:image/png;base64,testqrcodedata',
              },
              authorizationRequest: {
                uri: 'openid4vp://authorize?...',
              },
            },
          },
        },
      },
      nextStep: {
        name: 'verifiable-credential-challenge',
      },
    } as unknown as IdxTransaction;

    widgetProps = {} as WidgetProps;

    formBag = {
      schema: {},
      uischema: {
        type: UISchemaLayoutType.VERTICAL,
        elements: [],
      },
      data: {},
      dataSchema: {
        submit: {
          step: 'verifiable-credential-challenge',
        },
        fieldsToTrim: [],
        fieldsToValidate: [],
        fieldsToExclude: () => [],
      },
    } as FormBag;
  });

  it('should create UI elements for verifiable credential challenge', () => {
    const result = transformVerifiableCredentialChallenge({
      transaction,
      formBag,
      widgetProps,
    });

    expect(result.uischema.elements).toHaveLength(4);
    expect(result.uischema.elements[0]).toMatchObject({
      type: 'Title',
    });
    expect(result.uischema.elements[1]).toMatchObject({
      type: 'Description',
      contentType: 'subtitle',
    });
    expect(result.uischema.elements[2]).toMatchObject({
      type: 'QRCode',
      options: {
        data: 'data:image/png;base64,testqrcodedata',
      },
    });
    expect(result.uischema.elements[3]).toMatchObject({
      type: 'Description',
      contentType: 'subtitle',
    });
  });

  it('should use fallback QR code data when not provided in transaction', () => {
    transaction = {
      context: {},
      nextStep: {
        name: 'verifiable-credential-challenge',
      },
    } as unknown as IdxTransaction;

    const result = transformVerifiableCredentialChallenge({
      transaction,
      formBag,
      widgetProps,
    });

    expect(result.uischema.elements[2]).toMatchObject({
      type: 'QRCode',
      options: {
        data: 'https://example.com/vdc-placeholder',
      },
    });
  });
});
