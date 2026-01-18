declare module 'react-confetti';

declare namespace JSX {
  interface IntrinsicElements {
    'elevenlabs-convai': React.DetailedHTMLProps<React.HTMLAttributes<HTMLElement> & { 
      'agent-id'?: string;
      variant?: string;
      'avatar-orb-color-1'?: string;
      'avatar-orb-color-2'?: string;
      'style-base-color'?: string;
    }, HTMLElement>;
  }
}
