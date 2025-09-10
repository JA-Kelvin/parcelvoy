// Prebuilt custom MJML templates for quick insertion
import { TemplateBlock } from '../types'
import { parseMJMLString } from '../utils/mjmlParser'

// NOTE: IDs here are placeholders and will be reassigned on insertion

// TemplateBlock interface moved to '../types' for global reuse

// Helper: parse an MJML fragment and return section/wrapper roots (children of mj-body)
const fragmentToElements = (fragment: string) => {
    try {
        const parsed = parseMJMLString(fragment)
        const mjmlRoot = parsed.find(el => el.tagName === 'mjml')
        const body = mjmlRoot?.children?.find(el => el.tagName === 'mj-body')
        const roots = (body?.children ?? parsed) as any[]
        // Only keep top-level nodes valid under mj-body so insertion works (sections/wrappers)
        return (roots || []).filter(
            (el: any) => el && (el.tagName === 'mj-section' || el.tagName === 'enhanced-section' || el.tagName === 'mj-wrapper'),
        )
    } catch (e) {
        console.error('Failed to parse preset template fragment:', e)
        return []
    }
}

// Preset: Three Card Row (3 columns: image + title + text + CTA)
const THREE_CARD_ROW = `
<mj-section padding="10px 25px">
  <mj-column>
    <mj-image width="185px" src="https://placehold.co/185x120/png" alt="Leaf 1" border-radius="8px" />
    <mj-text font-size="20px" color="#5f6368" font-weight="bold">
      Some title here
    </mj-text>
    <mj-text font-size="14px" color="#5f6368">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed diam nonumy eirmod tempor.
    </mj-text>
    <mj-button background-color="#757575" color="#ffffff" padding="10px 25px" border-radius="8px" font-size="14px">
      Call to action
    </mj-button>
  </mj-column>
  <mj-column>
    <mj-image width="185px" src="https://placehold.co/185x120/png" alt="Leaf 2" border-radius="8px" />
    <mj-text font-size="20px" color="#5f6368" font-weight="bold">
      Some title here
    </mj-text>
    <mj-text font-size="14px" color="#5f6368">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed diam nonumy eirmod tempor.
    </mj-text>
    <mj-button background-color="#757575" color="#ffffff" padding="10px 25px" border-radius="8px" font-size="14px">
      Call to action
    </mj-button>
  </mj-column>
  <mj-column>
    <mj-image width="185px" src="https://placehold.co/185x120/png" alt="Leaf 3" border-radius="8px" />
    <mj-text font-size="20px" color="#5f6368" font-weight="bold">
      Some title here
    </mj-text>
    <mj-text font-size="14px" color="#5f6368">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed diam nonumy eirmod tempor.
    </mj-text>
    <mj-button background-color="#757575" color="#ffffff" padding="10px 25px" border-radius="8px" font-size="14px">
      Call to action
    </mj-button>
  </mj-column>
</mj-section>
`

// Individual template fragments split from MARKETING_BLOCKS
const HERO_IMAGE_TITLE_CTA = `
<mj-section>
  <mj-column width="100%">
    <mj-image alt="Green leaves" src="https://placehold.co/600x200/png" width="600" border-radius="8px" />
    <mj-text align="center" color="#333" font-size="24px" font-weight="bold">
      <p>Some title here</p>
    </mj-text>
    <mj-button href="#" align="center" color="#fff" padding="15px 10px 15px 10px" border-radius="8px" background-color="#666">
      Call to action
    </mj-button>
  </mj-column>
</mj-section>
`

const FEATURE_IMAGE_LEFT_TEXT_RIGHT = `
<mj-section padding="10px 25px">
  <mj-column>
    <mj-image alt="Orange flower" src="https://placehold.co/270x288/png" width="270" border-radius="8px" />
  </mj-column>
  <mj-column>
    <mj-text color="#f00" padding="0px 10px 0px 10px" font-size="16px" font-weight="bold" line-height="1">
      New!
    </mj-text>
    <mj-text color="#333" padding="15px 10px 15px 10px" font-size="24px" font-weight="bold">
      Some title here
    </mj-text>
    <mj-text color="#333" padding="0px 10px 0px 10px" font-size="16px" font-weight="bold" line-height="1">
      <p>From 20€</p>
    </mj-text>
    <mj-text color="#666" padding="15px 10px 15px 10px" font-size="14px" line-height="1.5">
      <p>Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed diam nonummy eirmod tempor invidunt ut labore et dolore magna aliquyam erat.</p>
    </mj-text>
    <mj-button href="#" align="left" color="#fff" padding="10px 25px" border-radius="8px" background-color="#666">
      Call to action
    </mj-button>
  </mj-column>
</mj-section>
`

const PRODUCT_SPOTLIGHT = `
<mj-section padding="10px 25px">
  <mj-column width="25%">
    <mj-image alt="Flower" src="https://placehold.co/120x168/png" width="120px" border-radius="8px" />
  </mj-column>
  <mj-column width="75%">
    <mj-text color="#1a73e8" padding="5px 10px 5px 10px" font-size="20px" font-weight="bold">
      Some title here
    </mj-text>
    <mj-text color="#1a73e8" padding="5px 10px 5px 10px" font-size="18px">
      <s>49.99€</s> 39.99€
    </mj-text>
    <mj-text color="#5f6368" padding="15px 10px 15px 10px" font-size="14px">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed diam nonumy eirmod tempor invidunt ut labore.
    </mj-text>
    <mj-button color="#ffffff" padding="10px 25px" font-size="14px" border-radius="8px" background-color="#757575">
      Call to action
    </mj-button>
  </mj-column>
</mj-section>
`

const FEATURES_TRIO = `
<mj-section padding="10px 25px">
  <mj-column>
    <mj-image alt="Leaf 1" src="https://placehold.co/185x120/png" width="185px" border-radius="8px" />
    <mj-text color="#5f6368" font-size="20px" font-weight="bold">
      Some title here
    </mj-text>
    <mj-text color="#5f6368" font-size="14px">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed diam nonumy eirmod tempor.
    </mj-text>
    <mj-button color="#ffffff" padding="10px 25px" font-size="14px" border-radius="8px" background-color="#757575">
      Call to action
    </mj-button>
  </mj-column>
  <mj-column>
    <mj-image alt="Leaf 2" src="https://placehold.co/185x120/png" width="185px" border-radius="8px" />
    <mj-text color="#5f6368" font-size="20px" font-weight="bold">
      Some title here
    </mj-text>
    <mj-text color="#5f6368" font-size="14px">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed diam nonumy eirmod tempor.
    </mj-text>
    <mj-button color="#ffffff" padding="10px 25px" font-size="14px" border-radius="8px" background-color="#757575">
      Call to action
    </mj-button>
  </mj-column>
  <mj-column>
    <mj-image alt="Leaf 3" src="https://placehold.co/185x120/png" width="185px" border-radius="8px" />
    <mj-text color="#5f6368" font-size="20px" font-weight="bold">
      Some title here
    </mj-text>
    <mj-text color="#5f6368" font-size="14px">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed diam nonumy eirmod tempor.
    </mj-text>
    <mj-button color="#ffffff" padding="10px 25px" font-size="14px" border-radius="8px" background-color="#757575">
      Call to action
    </mj-button>
  </mj-column>
</mj-section>
`

const HERO_WITH_BACKGROUND = `
<mj-section padding="10px 25px" background-url="https://placehold.co/1250x835/png" background-size="cover" background-repeat="no-repeat">
  <mj-column padding="100px 15px">
    <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
      Some title here
    </mj-text>
    <mj-text align="center" color="#ffffff" font-size="14px">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed diam nonumy eirmod tempor invidunt ut labore et dolore magna aliquyam erat, sed diam voluptua. At vero eos et accusam et justo duo dolores et ea rebum.
    </mj-text>
    <mj-button align="center" color="#ffffff" font-size="14px" border-radius="8px" background-color="#757575">
      Call to action
    </mj-button>
  </mj-column>
</mj-section>
`

const SIDE_IMAGE_HERO = `
<mj-section padding="10px 25px" background-url="https://placehold.co/600x420/png" background-size="cover" background-color="#333333" background-repeat="no-repeat">
  <mj-column padding="150px 300px 150px 0">
    <mj-text align="center" color="#ffffff" font-size="24px" font-weight="bold">
      Some title here
    </mj-text>
    <mj-text align="center" color="#ffffff" font-size="14px">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed diam nonumy eirmod tempor.
    </mj-text>
    <mj-button align="center" color="#ffffff" border-radius="8px" background-color="#757575">
      Call to action
    </mj-button>
  </mj-column>
</mj-section>
`

const AUTHOR_BYLINE = `
<mj-section padding="10px 25px">
  <mj-column width="30%">
    <mj-image alt="Profile" src="https://placehold.co/115x115/png" width="115px" border-radius="400px" />
  </mj-column>
  <mj-column width="70%">
    <mj-text color="#1a73e8" padding="0px 10px 0px 10px" font-size="20px" font-weight="bold">
      Some title here
    </mj-text>
    <mj-text color="#1a73e8" padding="0px 10px 0px 10px" font-size="16px">
      By Anna Smith
    </mj-text>
    <mj-divider padding="10px 10px 10px 10px" border-color="#757575" border-width="1px" />
    <mj-text color="#5f6368" padding="15px 10px 15px 10px" font-size="14px">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed diam nonumy eirmod tempor invidunt ut labore.
    </mj-text>
  </mj-column>
</mj-section>
`

const AUTHOR_BYLINE_2 = `
<mj-section padding="10px 25px">
  <mj-column width="70%">
    <mj-text font-size="24px" color="#000000" align="center">”</mj-text>
    <mj-text font-size="14px" color="#000000" align="center">
      Lorem ipsum dolor sit amet, consectetur adipiscing elit,
    </mj-text>
    <mj-text font-size="12px" color="#000000" align="center">
      -Anna Smith, London
    </mj-text>
  </mj-column>
  <mj-column width="30%">
    <mj-image alt="Profile" src="https://placehold.co/145x145/png" width="145px" border-radius="400px" />
  </mj-column>
</mj-section>
`

export const CUSTOM_TEMPLATES: TemplateBlock[] = [
    {
        id: 'preset-three-card-row',
        name: 'Three Card Row',
        description: '3 columns with image, title, text and CTA',
        elements: fragmentToElements(THREE_CARD_ROW),
    },
    {
        id: 'preset-hero-image-title-cta',
        name: 'Hero: Image + Title + CTA',
        description: 'Full-width hero with image, centered title and button',
        elements: fragmentToElements(HERO_IMAGE_TITLE_CTA),
    },
    {
        id: 'preset-feature-image-left',
        name: 'Feature: Image Left, Text Right',
        description: 'Two-column feature section with price and CTA',
        elements: fragmentToElements(FEATURE_IMAGE_LEFT_TEXT_RIGHT),
    },
    {
        id: 'preset-product-spotlight',
        name: 'Product Spotlight',
        description: 'Image + details and discounted price with CTA',
        elements: fragmentToElements(PRODUCT_SPOTLIGHT),
    },
    {
        id: 'preset-features-trio',
        name: 'Features Trio',
        description: 'Three feature columns with image, text, and CTA',
        elements: fragmentToElements(FEATURES_TRIO),
    },
    {
        id: 'preset-hero-with-background',
        name: 'Hero with Background',
        description: 'Full-bleed background image hero with centered CTA',
        elements: fragmentToElements(HERO_WITH_BACKGROUND),
    },
    {
        id: 'preset-side-image-hero',
        name: 'Side Image Hero',
        description: 'Side-aligned background hero with overlay content',
        elements: fragmentToElements(SIDE_IMAGE_HERO),
    },
    {
        id: 'preset-author-byline',
        name: 'Author Byline',
        description: 'Author block with avatar and text',
        elements: fragmentToElements(AUTHOR_BYLINE),
    },
    {
        id: 'preset-author-byline-2',
        name: 'Author Byline 2',
        description: 'Author block with avatar and text v2',
        elements: fragmentToElements(AUTHOR_BYLINE_2),
    },
]
