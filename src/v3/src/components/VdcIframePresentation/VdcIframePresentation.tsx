/*
 * Copyright (c) 2026-present, Okta, Inc. and/or its affiliates. All rights reserved.
 * The Okta software accompanied by this notice is provided pursuant to the Apache License, Version 2.0 (the "License.")
 *
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0.
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS, WITHOUT
 * WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *
 * See the License for the specific language governing permissions and limitations under the License.
 */

import { useEffect, useRef } from 'preact/hooks';

import Logger from '../../../../util/Logger';
import { useOnSubmit } from '../../hooks';
import {
  UISchemaElementComponent,
  VdcIframePresentationElement,
} from '../../types';

/**
 * Embeds the VDC wallet-iframe microfrontend and coordinates the postMessage protocol:
 *
 * 1. iframe loads → sends IFRAME_READY
 * 2. User clicks button in iframe → sends USER_INTERACTION
 * 3. SIW receives USER_INTERACTION → sends CREDENTIAL_REQUEST with dcApiPayload
 * 4. iframe calls navigator.credentials.get() → sends CREDENTIAL_RESPONSE
 * 5. SIW submits response to IDX
 */
const VdcIframePresentation: UISchemaElementComponent<{
  uischema: VdcIframePresentationElement
}> = ({ uischema }) => {
  const {
    options: {
      iframeSrc,
      presentationDefinition,
      step,
    },
  } = uischema;

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const onSubmitHandler = useOnSubmit();

  useEffect(() => {
    const iframeOrigin = new URL(iframeSrc).origin;

    const handleMessage = (event: MessageEvent) => {
      // Only accept messages from the iframe's origin
      if (event.origin !== iframeOrigin) {
        return;
      }

      const { type, payload, error } = event.data || {};

      switch (type) {
        case 'IFRAME_READY':
          Logger.info('VdcIframePresentation: iframe ready');
          break;

        case 'USER_INTERACTION':
          // User clicked the button in the iframe — send the credential request
          Logger.info('VdcIframePresentation: user interaction, sending CREDENTIAL_REQUEST');
          iframeRef.current?.contentWindow?.postMessage(
            { type: 'CREDENTIAL_REQUEST', payload: presentationDefinition },
            iframeSrc,
          );
          break;

        case 'CREDENTIAL_RESPONSE':
          Logger.info('VdcIframePresentation: credential response received');
          onSubmitHandler({
            step,
            params: {
              credentials: {
                vdcAuthorizationResponse: payload?.data || payload,
              },
            },
          });
          break;

        case 'CREDENTIAL_ERROR':
          Logger.error(`VdcIframePresentation: credential error: ${error}`);
          break;

        default:
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <iframe
      ref={iframeRef}
      src={iframeSrc}
      allow="digital-credentials-get; identity-credentials-get; publickey-credentials-get"
      title="Digital Credential Presentation"
      width="100%"
      height="250"
      frameBorder={0}
    />
  );
};

export default VdcIframePresentation;
