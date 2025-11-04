export const consultingFlowSegment = {
  "id": "consulting",
  "title": "Consulting Career Stream",
  "start": "AL1",
  "nodes": {
    "AL1": {
      "type": "video",
      "title": "Introduction Video",
      "video": "https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/ExploreYou%20Intro.mp4",
      "overlays": [
        {
          "html": "PASTE_OVERLAY_HTML_AL1"
        }
      ],
      "choices": [
        {
          "label": "How to Play",
          "next": "AZ1"
        },
        {
          "label": "Start Simulationn",
          "next": "F1"
        }
      ]
    },
    "F1": {
      "type": "video",
      "title": "Partner Welcome Video",
      "video": "https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/Partner%20First%20Day%20.mp4",
      "choices": [
        {
          "label": "Address Nervousness",
          "next": "G1"
        },
        {
          "label": "Ask About Flight",
          "next": "H1"
        },
        {
          "label": "Skip Ahead",
          "next": "AN1"
        }
      ]
    },
    "G1": {
      "type": "video",
      "title": "Partner Addressing Nervousness",
      "video": "https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/Nervouse%20Energy%20Partner.mp4",
      "choices": [
        {
          "label": "Morning Option 1",
          "next": "AN1"
        },
        {
          "label": "Morning Option 2",
          "next": "AM1"
        }
      ]
    },
    "H1": {
      "type": "video",
      "title": "Partner Asking About Flight",
      "video": "https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/in%20flight%20option%20for%20excited.mp4",
      "choices": [
        {
          "label": "Morning O+ption 1",
          "next": "AO1"
        },
        {
          "label": "Morning Option 2",
          "next": "AM1"
        }
      ]
    },
    "AN1": {
      "type": "video",
      "title": "Monday 6:30 AM (Path 1)",
      "video": "https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/Monday%20630%20am.mp4",
      "choices": [
        {
          "label": "Laptop Review",
          "next": "I1"
        },
        {
          "label": "Inbox Triage",
          "next": "L1"
        }
      ]
    },
    "AM1": {
      "type": "video",
      "title": "Monday 6:30 AM (Path 2)",
      "video": "https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/Monday%20630%20am.mp4",
      "choices": [
        {
          "label": "Laptop Review",
          "next": "J1"
        },
        {
          "label": "Inbox Triage",
          "next": "L1"
        }
      ]
    },
    "AO1": {
      "type": "video",
      "title": "Monday 6:30 AM (Sleep Variant)",
      "video": "https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/Monday%20630%20am.mp4",
      "choices": [
        {
          "label": "Sleep Consequences",
          "next": "K1"
        },
        {
          "label": "Inbox Triage",
          "next": "L1"
        }
      ]
    },
    "I1": {
      "type": "video",
      "title": "https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/Airplane%20Video.mp4",
      "choices": [
        {
          "label": "Inbox",
          "next": "L1"
        },
        {
          "label": "Market Intelligence",
          "next": "O1"
        }
      ]
    },
    "J1": {
      "type": "video",
      "title": "Airplane Video of Laptop (Alt)",
      "video": "https://roeobspqokpkhwbduyid.supabase.co/storage/v1/object/public/videos/Airplane%20Video.mp4",
      "choices": [
        {
          "label": "Inbox",
          "next": "L1"
        },
        {
          "label": "Market Intelligence",
          "next": "O1"
        }
      ]
    }
  }
} as const;
