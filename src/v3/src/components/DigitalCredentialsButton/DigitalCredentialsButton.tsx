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

import { Button as OdyButton } from '@okta/odyssey-react-mui';
import { h } from 'preact';
import { useAutoFocus, useOnSubmit } from 'src/hooks';
import { DigitalCredentialsButtonElement, UISchemaElementComponent } from 'src/types';

const DigitalCredentialsButton: UISchemaElementComponent<{
  uischema: DigitalCredentialsButtonElement
}> = ({ uischema }) => {
  const { focus } = uischema;
  const { presentationDefinition } = uischema.options;
  const onSubmitHandler = useOnSubmit();
  const focusRef = useAutoFocus<HTMLButtonElement>(focus);

  const handleClick = async () => {
    if (presentationDefinition) {
      // c) Trigger DC API
      const signedCredentialResponse = await navigator.credentials.get({
        mediation: 'required',
        // @ts-expect-error: digital is an experimental property not in CredentialRequestOptions type
        digital: { requests: presentationDefinition.requests },
      });
      await onSubmitHandler({
        step: 'verifiable-credential-challenge',
        params: {
          presentation: {
            ...presentationDefinition,
          },
          credentials: {
            vdcAuthorizationResponse: (signedCredentialResponse as any).data.response,
          },
        },
      });
    }
  };

  return (
    <OdyButton
      variant="secondary"
      isFullWidth
      onClick={handleClick}
      buttonRef={focusRef}
      label="Start dc api"
    />
  );
};

export default DigitalCredentialsButton;
