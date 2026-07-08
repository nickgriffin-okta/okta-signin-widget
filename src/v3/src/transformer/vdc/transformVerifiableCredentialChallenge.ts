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
  TitleElement,
  VdcIframePresentationElement,
} from 'src/types';

/**
 * Transformer for the Verifiable Credential Challenge step.
 * This step displays a QR code that contains the authorization request data
 * for starting a verifiable credentials verification flow.
 */
export const transformVerifiableCredentialChallenge: IdxStepTransformer = ({
  transaction,
  formBag,
  widgetProps,
}) => {
  const { uischema } = formBag;
  const { brandName } = widgetProps;

  // const currentAuthenticator = transaction.context?.currentAuthenticator;
  // Find the verifiable-credential-challenge remediation
  const remediation = transaction.neededToProceed?.find((r) => r.name === 'verifiable-credential-challenge');
  const presentationData = remediation?.value?.find((val) => val.name === 'presentation')?.value;
  const title = brandName ? `Reset your ${brandName} password` : 'Reset your password';

  const titleElement: TitleElement = {
    type: 'Title',
    options: {
      content: title,
    },
  };

  const descriptionElement: DescriptionElement = {
    type: 'Description',
    contentType: 'subtitle',
    options: {
      content: 'To continue, we need to verify your identity with your mobile driver’s license.',
    },
  };

  const instructionsElement: DescriptionElement = {
    type: 'Description',
    contentType: 'subtitle',
    options: {
      content: 'You can use any compatible digital wallet app to scan the QR code and share your credentials.',
    },
  };

  // If iframeSrc is present, use the iframe path (Apple Wallet domain verification workaround)
  const iframeSrc = presentationData?.iframeSrc;

  if (iframeSrc) {
    const iframeElement: VdcIframePresentationElement = {
      type: 'VdcIframePresentation',
      options: {
        iframeSrc,
        presentationDefinition: presentationData,
        step: 'verifiable-credential-challenge',
      },
    };

    uischema.elements = [
      titleElement,
      descriptionElement,
      iframeElement,
    ];
  } else {
    // Direct DC API path (existing behavior — no iframe needed)
    const initiateRequestButton: DigitalCredentialsButtonElement = {
      type: 'DigitalCredentialsButton',
      options: {
        presentationDefinition: presentationData,
      },
    };

    uischema.elements = [
      titleElement,
      descriptionElement,
      initiateRequestButton,
      instructionsElement,
    ];
  }

  return formBag;
};
