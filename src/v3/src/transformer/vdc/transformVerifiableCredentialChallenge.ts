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

import {
  DescriptionElement,
  DigitalCredentialsButtonElement,
  IdxStepTransformer,
  // QRCodeElement,
  TitleElement,
} from '../../types';
import { loc } from '../../util';

/**
 * Transformer for the Verifiable Credential Challenge step.
 * This step displays a QR code that contains the authorization request data
 * for starting a verifiable credentials verification flow.
 */
export const transformVerifiableCredentialChallenge: IdxStepTransformer = ({
  transaction,
  formBag,
}) => {
  const { uischema } = formBag;

  // const currentAuthenticator = transaction.context?.currentAuthenticator;
  // Find the verifiable-credential-challenge remediation
  const remediation = transaction.neededToProceed?.find((r) => r.name === 'verifiable-credential-challenge');
  const presentationData = remediation?.value?.find((val) => val.name === 'presentation')?.value;

  /* const qrCodeHref = currentAuthenticator?.value?.contextualData?.qrcode?.href
    // Fallback to a placeholder for development/testing
    ?? 'https://example.com/vdc-placeholder'; */

  const titleElement: TitleElement = {
    type: 'Title',
    options: {
      content: 'This is a POC of verifiable credentials login flow',
    },
  };

  const descriptionElement: DescriptionElement = {
    type: 'Description',
    contentType: 'subtitle',
    options: {
      content: 'click on start dc api button',
    },
  };

  /* const qrCodeElement: QRCodeElement = {
    type: 'QRCode',
    translations: [
      {
        i18nKey: 'oie.verify.credential.qrcode.alt',
        name: 'label',
        value: loc('oie.verify.credential.qrcode.alt', 'login'),
      },
    ],
    options: {
      data: qrCodeHref,
    },
  }; */

  const initiateRequestButton: DigitalCredentialsButtonElement = {
    type: 'DigitalCredentialsButton',
    options: {
      presentationDefinition: presentationData,
    },
  };

  const instructionsElement: DescriptionElement = {
    type: 'Description',
    contentType: 'subtitle',
    options: {
      content: 'use Android ;) ',
    },
  };

  uischema.elements = [
    titleElement,
    descriptionElement,
    initiateRequestButton,
    // qrCodeElement,
    instructionsElement,
  ];

  return formBag;
};
