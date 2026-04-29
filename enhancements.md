# Enhancements for Online Wardley Maps

> **Note (2026-04-29):** This document was written against the legacy CRA / React 16 codebase that was current on `master` until April 2026. The active codebase has since been re-forked from upstream `damonsk/onlinewardleymaps` and is now Next.js 16 / React 19 / TypeScript / MUI 7 with the frontend rooted at `frontend/`. The *ideas* in this document remain valid and form the product roadmap, but the **code snippets, file paths, and architecture references throughout this file are stale**. Use them for the conceptual approach only — implementation has to be ported to the new codebase. See `CLAUDE.md` for the current architecture.

---


This document outlines potential enhancements and improvements for the Online Wardley Maps platform. These suggestions are compiled from various analysis sessions and represent opportunities to expand functionality, improve user experience, and integrate modern development practices.

## Version Control and Collaboration

### GitHub Integration Options
**Priority: High**

After analyzing the codebase, the text-based DSL format used by Online Wardley Maps is perfectly suited for Git versioning. The maps are stored as plain text using a domain-specific language, making them ideal for diff tracking, branching, and collaboration workflows.

**Current Architecture:**
- Maps stored as text using custom DSL (`component Name [x, y]`)
- API endpoint: `https://maps.wardleymaps.ai/v2/maps/`
- Save/load via `fetch` and `save` endpoints
- Real-time conversion from text to visual representation

#### Option 1: GitHub Gists Integration
**Simplest approach - minimal changes to existing architecture**

```javascript
// New GitHub Gist API integration
const saveToGist = async (mapText, metaText, mapTitle) => {
  const gist = await fetch('https://api.github.com/gists', {
    method: 'POST',
    headers: { 
      'Authorization': `token ${userToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      description: mapTitle,
      public: false,
      files: {
        'map.owm': { content: mapText },
        'meta.json': { content: metaText }
      }
    })
  });
  return gist.json();
};

// Load from Gist
const loadFromGist = async (gistId) => {
  const response = await fetch(`https://api.github.com/gists/${gistId}`);
  const gist = await response.json();
  return {
    mapText: gist.files['map.owm'].content,
    metaText: gist.files['meta.json'].content
  };
};
```

**UI Changes:**
- Add "Save to GitHub" button alongside existing save
- Version history dropdown showing Gist commits
- Share button generates Gist URL

**Pros:**
- Built-in versioning via Gist history
- Easy sharing via Gist URLs  
- Minimal UI changes needed
- Works with existing save/load flow
- GitHub handles authentication and rate limiting

**Cons:**
- Limited collaboration features
- GitHub API rate limits (5000 requests/hour)
- Requires GitHub authentication
- Gists have limited discoverability

#### Option 2: Personal GitHub Repository Per User
**Each user gets their own maps repository**

```javascript
// Create user's maps repository
const createUserMapsRepo = async (username) => {
  return fetch(`https://api.github.com/user/repos`, {
    method: 'POST',
    headers: { 'Authorization': `token ${userToken}` },
    body: JSON.stringify({
      name: `${username}-wardley-maps`,
      description: 'My Wardley Maps',
      private: true,
      auto_init: true
    })
  });
};

// Save map as file in repo
const saveMapToRepo = async (mapId, mapText, commitMessage) => {
  const path = `maps/${mapId}.owm`;
  return fetch(`https://api.github.com/repos/${username}/${repoName}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Authorization': `token ${userToken}` },
    body: JSON.stringify({
      message: commitMessage || `Update map: ${mapTitle}`,
      content: btoa(mapText), // Base64 encode
      sha: existingSha // For updates
    })
  });
};
```

**Repository Structure:**
```
username-wardley-maps/
├── README.md
├── maps/
│   ├── tea-shop-map.owm
│   ├── business-strategy.owm
│   └── product-evolution.owm
└── collections/
    ├── startup-journey/
    └── enterprise-architecture/
```

**Pros:**
- Full Git history per map
- Branching/tagging capabilities for map versions
- User owns their data completely
- Can use GitHub's web interface for advanced operations
- Natural organization with folders/collections

**Cons:**
- More complex setup and onboarding
- Repository management overhead
- Need full GitHub OAuth flow
- Users need to understand Git concepts

#### Option 3: Hybrid System with GitHub Sync
**Keep existing API, add GitHub as backup/versioning layer**

```javascript
// Enhanced save function
const saveMapWithVersioning = async (mapData) => {
  // Save to existing API first (fast, reliable)
  const apiResult = await saveToRemoteStorage(mapData);
  
  // Async sync to GitHub for versioning (non-blocking)
  if (userHasGitHubConnected) {
    syncToGitHub(mapData, apiResult.id).catch(err => {
      console.warn('GitHub sync failed:', err);
      // Show optional notification to user
    });
  }
  
  return apiResult;
};

// Version comparison UI
const showVersionHistory = async (mapId) => {
  const [apiVersion, githubVersions] = await Promise.all([
    fetchMapFromAPI(mapId),
    fetchGitHubHistory(mapId)
  ]);
  
  return {
    current: apiVersion,
    history: githubVersions,
    canRestore: true
  };
};
```

**Pros:**
- Maintains current speed and reliability
- Optional GitHub integration (gradual adoption)
- Best of both worlds (fast API + rich versioning)
- Gradual migration path for users
- Fallback if GitHub is unavailable

**Cons:**
- Data synchronization complexity
- Potential consistency issues between systems
- Doubled storage costs
- More complex error handling

#### Option 4: Git-in-Browser with Push/Pull
**Full Git workflow in the browser using isomorphic-git**

```javascript
import git from 'isomorphic-git';
import http from 'isomorphic-git/http/web';
import FS from '@isomorphic-git/lightning-fs';

const fs = new FS('wardley-maps');

// Initialize local Git repo in browser
const initLocalRepo = async () => {
  await git.init({ fs, dir: '/maps' });
  await git.addRemote({ 
    fs, 
    dir: '/maps', 
    remote: 'origin', 
    url: userRepoUrl,
    force: true
  });
};

// Commit and push changes
const commitAndPush = async (mapText, message) => {
  await fs.promises.writeFile('/maps/current-map.owm', mapText);
  await git.add({ fs, dir: '/maps', filepath: 'current-map.owm' });
  await git.commit({ 
    fs, 
    dir: '/maps', 
    message, 
    author: { name: userName, email: userEmail }
  });
  await git.push({ 
    fs, 
    dir: '/maps', 
    http, 
    remote: 'origin',
    ref: 'main'
  });
};
```

**Pros:**
- Full Git capabilities in browser
- Offline support with automatic sync
- Real collaboration workflows (branches, merges)
- Professional version control experience
- No server-side dependencies

**Cons:**
- Significant complexity for users and developers
- Large bundle size impact (~2MB for isomorphic-git)
- Browser storage limitations (quotas)
- Steep learning curve for non-technical users
- CORS limitations with some Git providers

#### Option 5: GitHub-Centric with Map Editor Integration
**Make GitHub the primary storage, enhance with map-specific features**

```javascript
// Map-aware commit messages
const generateMapCommitMessage = (oldMap, newMap) => {
  const changes = analyzeMapChanges(oldMap, newMap);
  
  return `Update map: ${changes.summary}

Components:
${changes.componentsAdded.map(c => `+ Added: ${c.name}`).join('\n')}
${changes.componentsRemoved.map(c => `- Removed: ${c.name}`).join('\n')}
${changes.componentsModified.map(c => `~ Modified: ${c.name} (${c.changes})`).join('\n')}

Links: ${changes.linksModified} modified
Evolution: ${changes.evolutionChanges} updates
Annotations: ${changes.annotationsChanged} changes`;
};

// Visual diff for maps
const showMapDiff = async (commit1, commit2) => {
  const [map1Content, map2Content] = await Promise.all([
    fetchCommitContent(commit1),
    fetchCommitContent(commit2)
  ]);
  
  const map1 = new Converter().parse(map1Content);
  const map2 = new Converter().parse(map2Content);
  
  return {
    sideBySide: true,
    leftMap: map1,
    rightMap: map2,
    changes: analyzeMapChanges(map1Content, map2Content),
    highlightedElements: getChangedElements(map1, map2)
  };
};
```

**Pros:**
- Rich version control metadata
- Map-specific diff visualization
- GitHub's collaboration tools (PRs, issues, discussions)
- Professional workflow integration
- Advanced features like branching for map experiments

**Cons:**
- Requires complete architecture rewrite
- Complex diff implementation for visual elements
- Heavy dependence on GitHub availability
- Overwhelming for casual users

### Recommended Implementation Strategy

#### Phase 1: GitHub Gists Integration (Option 1)
**Target: 2-4 weeks development**

1. Add GitHub OAuth to existing app
2. Implement Gist save/load alongside current API
3. Add version history UI component
4. Simple sharing via Gist URLs

#### Phase 2: Enhanced Hybrid System (Option 3)
**Target: 4-6 weeks development**

1. Migrate successful Gist users to personal repositories
2. Add automatic background sync
3. Implement visual diff for map changes
4. Add collaboration features (shared repositories)

#### Phase 3: Advanced Features (Option 5 elements)
**Target: 8-12 weeks development**

1. Smart commit message generation
2. Map-aware merge conflict resolution
3. Branch-based map development
4. Integration with GitHub's project management tools

### Technical Considerations

- **Authentication**: GitHub OAuth with appropriate scopes
- **Rate Limiting**: Implement exponential backoff and caching
- **Error Handling**: Graceful degradation when GitHub is unavailable
- **Privacy**: Clear user control over public/private repositories
- **Performance**: Async operations to avoid blocking the UI

**Benefits:**
- Version history and change tracking
- Real collaboration workflows
- Integration with existing developer tools
- Map diff visualization
- Backup and data ownership for users

## Server-Side Image Generation

### REST API for Map Images
**Priority: Medium**

Create server-side rendering capabilities:

```javascript
// New API endpoints
POST /v2/render - Generate image from map text
GET /v2/maps/{mapId}/image - Get existing map as image
```

**Implementation:**
- Express.js endpoint accepting OWM text via POST
- Leverage existing `Converter.parse()` to interpret map data
- Use headless browser (Puppeteer/Playwright) to render map
- Return PNG/SVG/PDF images of rendered maps

**Query Parameters:**
- `format`: png, svg, pdf (default: png)
- `style`: plain, color, wardley, handwritten
- `width`/`height`: custom dimensions
- `quality`: image quality for lossy formats

**Use Cases:**
- Automated report generation
- Integration with documentation systems
- Batch processing of maps
- API-driven map creation workflows
- Email notifications with map thumbnails

**Caching Strategy:**
- Redis cache for frequently accessed maps
- CDN integration for global distribution
- Cache invalidation on map updates

## Enhanced Editor Features

### Advanced Text Editor Capabilities
**Priority: Medium**

1. **Smart Auto-completion**
   - Context-aware suggestions based on existing components
   - Template snippets for common patterns
   - Auto-suggest component names for links

2. **Real-time Collaboration**
   - Multiple cursors showing collaborator positions
   - Live text synchronization
   - Change attribution and conflict resolution

3. **Advanced Search and Replace**
   - Regex support for complex text operations
   - Bulk component renaming
   - Find and replace with preview

4. **Code Folding and Organization**
   - Collapsible sections for large maps
   - Minimap overview for navigation
   - Bookmark system for quick navigation

### Visual Editor Enhancements
**Priority: Medium**

1. **Enhanced Drag and Drop**
   - Multi-select for bulk operations
   - Snap-to-grid functionality
   - Alignment guides and tools

2. **Advanced Linking**
   - Curved link paths
   - Link annotations and labels
   - Conditional link visibility

3. **Template System**
   - Pre-built map templates
   - Industry-specific starting points
   - Component libraries and symbols

## Analysis and Intelligence Features

### Map Analytics
**Priority: Low-Medium**

1. **Evolution Analysis**
   - Automated evolution path suggestions
   - Component maturity recommendations
   - Historical evolution tracking

2. **Dependency Analysis**
   - Component dependency graphs
   - Critical path identification
   - Impact analysis for changes

3. **Strategic Insights**
   - Pattern recognition across maps
   - Strategic move suggestions
   - Competitive landscape analysis

## Premium Features and Monetization

### Integration with Wardley Maps AI API
**Priority: High**

Leverage the existing `api.wardleymaps.ai` pricing tiers to create a freemium model with premium AI-powered features.

**Available API Services:**
- **Wardley Mapping Crew API**: Advanced mapping assistance
- **Open Wardley Maps API**: Core mapping functionality  
- **Knowledgebase API**: Access to mapping knowledge and best practices
- **Conversions API**: Transform maps between formats and enhance with AI

**Pricing Tiers Integration:**
```javascript
// User tier management
const UserTiers = {
  FREE: {
    name: 'Free',
    mapLimit: 10,
    aiRequests: 0,
    features: ['basic_editor', 'export_png', 'public_sharing']
  },
  STARTER: {
    name: 'Starter',
    price: '£10/month',
    mapLimit: 100,
    aiRequests: 100,
    features: ['ai_suggestions', 'private_maps', 'github_gists', 'advanced_export']
  },
  CHATGPT: {
    name: 'ChatGPT',
    price: '£10/month', 
    mapLimit: 50,
    aiRequests: 10000,
    features: ['ai_generation', 'bulk_conversions', 'api_access']
  },
  DEVELOPER: {
    name: 'Developer',
    price: '£50/month',
    mapLimit: 'unlimited',
    aiRequests: 500,
    features: ['full_api_access', 'priority_support', 'custom_integrations', 'team_collaboration']
  }
};

// Usage tracking and enforcement
class UsageManager {
  constructor(userTier, apiKey) {
    this.tier = UserTiers[userTier];
    this.apiKey = apiKey;
    this.usage = {
      mapsCreated: 0,
      aiRequestsUsed: 0,
      monthlyReset: new Date()
    };
  }

  async canUseAIFeature(featureType) {
    if (this.usage.aiRequestsUsed >= this.tier.aiRequests) {
      throw new Error('AI request limit reached. Upgrade to continue.');
    }
    return true;
  }

  async callWardleyMapsAPI(endpoint, data) {
    await this.canUseAIFeature('api_call');
    
    const response = await fetch(`https://api.wardleymaps.ai/v2/${endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });

    this.usage.aiRequestsUsed++;
    return response.json();
  }
}
```

### Premium AI Features

#### Tier 1: Starter Plan Integration
**AI-Enhanced Map Creation**
```javascript
// Enhanced map suggestions using Knowledgebase API
const getMapSuggestions = async (mapText, userTier) => {
  if (!userTier.features.includes('ai_suggestions')) {
    return { error: 'Upgrade to Starter plan for AI suggestions' };
  }

  const suggestions = await usageManager.callWardleyMapsAPI('knowledgebase/suggestions', {
    mapText,
    includePatterns: true,
    includeBestPractices: true
  });

  return {
    missingComponents: suggestions.components,
    patternRecommendations: suggestions.patterns,
    evolutionSuggestions: suggestions.evolution
  };
};

// Smart component positioning
const optimizeMapLayout = async (components) => {
  const optimization = await usageManager.callWardleyMapsAPI('crew/optimize-layout', {
    components,
    optimizeFor: ['readability', 'strategic_clarity']
  });

  return optimization.optimizedPositions;
};
```

#### Tier 2: ChatGPT Plan Features
**Bulk Conversions and Advanced AI**
```javascript
// Bulk map processing
const processBulkMaps = async (mapTexts) => {
  const results = await Promise.all(
    mapTexts.map(async (mapText) => {
      return usageManager.callWardleyMapsAPI('conversions/enhance', {
        input: mapText,
        outputFormat: 'owm_enhanced',
        addAnalysis: true
      });
    })
  );

  return results;
};

// Advanced AI generation
const generateMapFromDocument = async (documentContent) => {
  const generation = await usageManager.callWardleyMapsAPI('crew/generate-from-document', {
    content: documentContent,
    extractionLevel: 'detailed',
    includeStrategicInsights: true
  });

  return {
    generatedMap: generation.owmText,
    strategicInsights: generation.insights,
    confidence: generation.confidence
  };
};
```

#### Tier 3: Developer Plan Features
**Full API Access and Enterprise Features**
```javascript
// Custom integration builder
const createCustomIntegration = async (integrationConfig) => {
  const integration = await usageManager.callWardleyMapsAPI('developer/create-integration', {
    config: integrationConfig,
    webhooks: integrationConfig.webhooks,
    customEndpoints: integrationConfig.endpoints
  });

  return integration;
};

// Team collaboration features
const enableTeamCollaboration = async (teamConfig) => {
  const collaboration = await usageManager.callWardleyMapsAPI('crew/setup-team', {
    teamMembers: teamConfig.members,
    permissions: teamConfig.permissions,
    sharedResources: teamConfig.resources
  });

  return collaboration;
};
```

### Premium UI Components

```javascript
// Subscription management component
const SubscriptionManager = ({ currentTier, usage }) => {
  const [showUpgrade, setShowUpgrade] = useState(false);

  const handleUpgrade = async (newTier) => {
    // Integration with payment processor
    const checkout = await createCheckoutSession({
      priceId: UserTiers[newTier].priceId,
      successUrl: `${window.location.origin}/subscription/success`,
      cancelUrl: `${window.location.origin}/subscription/cancel`
    });
    
    window.location.href = checkout.url;
  };

  return (
    <div className="subscription-panel">
      <div className="current-plan">
        <h3>{currentTier.name} Plan</h3>
        <div className="usage-stats">
          <div className="usage-item">
            <span>Maps: {usage.mapsCreated}/{currentTier.mapLimit}</span>
            <ProgressBar 
              value={usage.mapsCreated} 
              max={currentTier.mapLimit} 
            />
          </div>
          <div className="usage-item">
            <span>AI Requests: {usage.aiRequestsUsed}/{currentTier.aiRequests}</span>
            <ProgressBar 
              value={usage.aiRequestsUsed} 
              max={currentTier.aiRequests} 
            />
          </div>
        </div>
      </div>
      
      {usage.aiRequestsUsed >= currentTier.aiRequests * 0.8 && (
        <div className="upgrade-prompt">
          <h4>Running low on AI requests</h4>
          <p>Upgrade to continue using AI features</p>
          <button onClick={() => handleUpgrade('DEVELOPER')}>
            Upgrade to Developer Plan
          </button>
        </div>
      )}
    </div>
  );
};

// Feature gate component
const FeatureGate = ({ feature, userTier, children, fallback }) => {
  const hasFeature = userTier.features.includes(feature);
  
  if (!hasFeature) {
    return fallback || (
      <div className="feature-locked">
        <div className="lock-icon">🔒</div>
        <p>This feature requires {getRequiredTier(feature)} plan</p>
        <button onClick={() => showUpgradeModal()}>
          Upgrade Now
        </button>
      </div>
    );
  }
  
  return children;
};

// Usage in components
const AIEnhanceButton = ({ mapText }) => {
  const { userTier } = useUser();
  
  return (
    <FeatureGate 
      feature="ai_suggestions" 
      userTier={userTier}
      fallback={
        <button className="upgrade-needed" onClick={() => showUpgradeModal()}>
          ✨ AI Enhance (Starter Plan Required)
        </button>
      }
    >
      <button onClick={() => enhanceWithAI(mapText)}>
        ✨ AI Enhance Map
      </button>
    </FeatureGate>
  );
};
```

### Monetization Strategy

#### Free Tier (Lead Generation)
- **10 maps limit**: Encourage serious use without abuse
- **Basic editor**: Full manual editing capabilities
- **Public sharing only**: Creates viral content
- **Export to PNG**: Basic functionality
- **Clear upgrade prompts**: When hitting limits

#### Paid Tiers (Revenue Generation)
```javascript
// Revenue optimization features
const RevenueFeatures = {
  // Starter Plan (£10/month) - Individual Power Users
  starter: {
    targetUser: 'Individual consultants, small teams',
    keyFeatures: [
      'AI-powered component suggestions',
      'Private map storage', 
      'GitHub Gists integration',
      'Advanced export formats (SVG, PDF)',
      'Basic strategic insights'
    ],
    conversionTriggers: [
      'Map limit reached',
      'Privacy needs',
      'Export requirements'
    ]
  },

  // ChatGPT Plan (£10/month) - API Users
  chatgpt: {
    targetUser: 'Developers, ChatGPT plugin users',
    keyFeatures: [
      'High-volume AI requests (10,000/month)',
      'Bulk map conversions',
      'API access for integrations',
      'Custom GPT development'
    ],
    conversionTriggers: [
      'API access needs',
      'Bulk processing requirements',
      'ChatGPT integration'
    ]
  },

  // Developer Plan (£50/month) - Enterprise
  developer: {
    targetUser: 'Enterprises, consulting firms, software teams',
    keyFeatures: [
      'Unlimited maps',
      'Full API suite access',
      'Team collaboration',
      'Priority support',
      'Custom integrations',
      'Advanced analytics'
    ],
    conversionTriggers: [
      'Team collaboration needs',
      'Enterprise features',
      'Support requirements'
    ]
  }
};
```

#### Implementation in Existing Codebase
```javascript
// Modify App.js to include subscription context
const App = () => {
  const [userSubscription, setUserSubscription] = useState(null);
  const [usage, setUsage] = useState(null);

  useEffect(() => {
    // Load user subscription and usage on app start
    loadUserSubscription().then(setUserSubscription);
    loadUsageStats().then(setUsage);
  }, []);

  return (
    <SubscriptionProvider value={{ userSubscription, usage }}>
      <div className="app">
        {/* Existing app structure */}
        <SubscriptionManager 
          currentTier={userSubscription?.tier || 'FREE'}
          usage={usage}
        />
      </div>
    </SubscriptionProvider>
  );
};

// Enhanced save function with usage tracking
const saveToRemoteStorage = async function(hash) {
  const { userSubscription, incrementUsage } = useSubscription();
  
  // Check map limits
  if (usage.mapsCreated >= userSubscription.tier.mapLimit) {
    showUpgradeModal('You\'ve reached your map limit. Upgrade to create more maps.');
    return;
  }

  try {
    const response = await fetch(Defaults.ApiEndpoint + 'save', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': `Bearer ${userSubscription.apiKey}`
      },
      body: JSON.stringify({ id: hash, text: mapText, meta: metaText }),
    });

    if (response.ok) {
      incrementUsage('mapsCreated');
      // ... existing success logic
    }
  } catch (error) {
    // ... existing error handling
  }
};
```

### Revenue Projections
```javascript
// Conservative estimates based on freemium conversion rates
const RevenueProjections = {
  // Year 1 targets
  freeUsers: 10000,      // Marketing/viral growth
  starterConversion: 2,  // 2% conversion rate (200 users)
  chatgptConversion: 0.5, // 0.5% conversion rate (50 users)  
  developerConversion: 0.1, // 0.1% conversion rate (10 users)
  
  monthlyRevenue: {
    starter: 200 * 10,    // £2,000
    chatgpt: 50 * 10,     // £500
    developer: 10 * 50,   // £500
    total: 3000           // £3,000/month
  },

  yearlyRevenue: 36000    // £36,000/year
};
```

This integration transforms the application from a free tool into a sustainable SaaS business while providing genuine value through AI-powered features that leverage the existing Wardley Maps AI API ecosystem.

## ChatGPT and AI Ecosystem Integration
**Priority: High**

### ChatGPT Plugin Development
**Based on Issue #159: "chatGPT plugin"**

Create a comprehensive ChatGPT plugin that leverages the ChatGPT API tier (£10/month, 10,000 requests).

```javascript
// ChatGPT Plugin Manifest
const pluginManifest = {
  schema_version: "v1",
  name_for_human: "Wardley Maps Creator",
  name_for_model: "wardley_maps",
  description_for_human: "Create and analyze Wardley Maps from natural language descriptions",
  description_for_model: "Tool for creating strategic Wardley Maps from business descriptions, analyzing existing maps, and providing strategic insights",
  auth: {
    type: "oauth",
    authorization_url: "https://create.wardleymaps.ai/auth/chatgpt",
    scope: "maps:create maps:read maps:analyze"
  },
  api: {
    type: "openapi",
    url: "https://create.wardleymaps.ai/.well-known/openapi.yaml"
  },
  logo_url: "https://create.wardleymaps.ai/logo.png",
  contact_email: "support@wardleymaps.ai"
};

// Plugin API Endpoints
const chatGPTEndpoints = {
  // Generate map from description
  "/api/chatgpt/generate": {
    method: "POST",
    description: "Generate a Wardley Map from natural language description",
    parameters: {
      description: "Business or strategy description",
      style: "plain|wardley|color|handwritten",
      includeAnalysis: "boolean"
    },
    response: {
      mapText: "OWM syntax",
      mapUrl: "https://create.wardleymaps.ai/#abc123",
      analysis: "Strategic insights and recommendations"
    }
  },

  // Analyze existing map
  "/api/chatgpt/analyze": {
    method: "POST", 
    description: "Analyze an existing Wardley Map and provide insights",
    parameters: {
      mapText: "OWM syntax or map URL",
      analysisType: "strategic|competitive|evolution|risks"
    },
    response: {
      insights: "Strategic analysis",
      recommendations: "Actionable suggestions",
      patterns: "Identified strategic patterns"
    }
  },

  // Interactive map editing
  "/api/chatgpt/edit": {
    method: "POST",
    description: "Edit a map based on natural language instructions",
    parameters: {
      mapId: "Map identifier",
      instruction: "Natural language edit instruction",
      confirmChanges: "boolean"
    },
    response: {
      updatedMap: "Modified OWM syntax",
      changes: "Summary of changes made",
      mapUrl: "Updated map URL"
    }
  }
};
```

### Usage Guide and Documentation System
**Enhanced onboarding and help system**

```javascript
// Interactive Tutorial System
const TutorialSystem = {
  // Progressive disclosure tutorial
  steps: [
    {
      id: "welcome",
      title: "Welcome to Wardley Maps",
      content: "Let's create your first strategic map",
      target: "#editor",
      action: "highlight"
    },
    {
      id: "add_component",
      title: "Add Your First Component",
      content: "Type: component Customer [0.9, 0.2]",
      target: "#ace-editor",
      action: "focus",
      expectedContent: "component Customer [0.9, 0.2]"
    },
    {
      id: "ai_assist",
      title: "Try AI Enhancement",
      content: "Click the ✨ AI Enhance button to get suggestions",
      target: ".ai-enhance-btn",
      action: "click",
      requiresSubscription: "starter"
    }
  ],

  // Context-sensitive help
  contextualHelp: {
    "component": {
      syntax: "component Name [evolution, visibility]",
      example: "component Customer [0.9, 0.2]",
      tips: "Evolution: 0=genesis, 1=commodity. Visibility: 0=invisible, 1=visible"
    },
    "link": {
      syntax: "ComponentA->ComponentB",
      example: "Customer->Service",
      tips: "Shows dependency relationships between components"
    }
  }
};

// Smart Help Widget
const SmartHelpWidget = () => {
  const [helpVisible, setHelpVisible] = useState(false);
  const [currentHelp, setCurrentHelp] = useState(null);
  
  // AI-powered help suggestions
  const getContextualHelp = async (editorContent, cursorPosition) => {
    if (userTier.features.includes('ai_suggestions')) {
      const help = await usageManager.callWardleyMapsAPI('help/contextual', {
        content: editorContent,
        position: cursorPosition
      });
      setCurrentHelp(help);
    }
  };

  return (
    <div className="smart-help-widget">
      <button onClick={() => setHelpVisible(!helpVisible)}>
        💡 Smart Help
      </button>
      {helpVisible && (
        <div className="help-panel">
          <div className="help-search">
            <input 
              placeholder="Ask anything about Wardley Mapping..."
              onChange={(e) => searchHelp(e.target.value)}
            />
          </div>
          {currentHelp && (
            <div className="contextual-help">
              <h4>💡 Suggestion</h4>
              <p>{currentHelp.suggestion}</p>
              <button onClick={() => applyHelp(currentHelp)}>
                Apply This
              </button>
            </div>
          )}
          <div className="help-categories">
            <HelpCategory title="Getting Started" icon="🚀" />
            <HelpCategory title="AI Features" icon="🤖" />
            <HelpCategory title="Advanced Mapping" icon="📊" />
          </div>
        </div>
      )}
    </div>
  );
};
```

### Comprehensive JSON Export System
**Based on Issue #165: "JSON Export for Wardley Map"**

```javascript
// Enhanced JSON Export with Multiple Formats
const ExportFormats = {
  // Standard Wardley Map JSON
  WARDLEY_JSON: {
    version: "2.0",
    schema: "https://wardleymaps.ai/schema/v2.json",
    export: (mapData) => ({
      metadata: {
        title: mapData.title,
        created: new Date().toISOString(),
        version: "2.0",
        generator: "create.wardleymaps.ai"
      },
      map: {
        components: mapData.elements.map(el => ({
          id: el.id,
          name: el.name,
          evolution: el.maturity,
          visibility: el.visibility,
          type: el.type || "component",
          description: el.description,
          inertia: el.inertia || false
        })),
        relationships: mapData.links.map(link => ({
          from: link.start,
          to: link.end,
          type: link.flow ? "flow" : "dependency"
        })),
        annotations: mapData.annotations,
        styling: mapData.presentation
      }
    })
  },

  // Miro Board Format
  MIRO_JSON: {
    export: (mapData) => ({
      type: "board",
      widgets: [
        ...mapData.elements.map(el => ({
          type: "shape",
          text: el.name,
          x: el.maturity * 1000,
          y: el.visibility * 600,
          style: { shapeType: "circle" }
        })),
        ...mapData.links.map(link => ({
          type: "line",
          startWidget: link.start,
          endWidget: link.end
        }))
      ]
    })
  },

  // Figma Plugin Format
  FIGMA_JSON: {
    export: (mapData) => ({
      nodes: mapData.elements.map(el => ({
        id: el.id,
        name: el.name,
        type: "ELLIPSE",
        x: el.maturity * 400,
        y: el.visibility * 300,
        fills: [{ type: "SOLID", color: { r: 0.2, g: 0.6, b: 1.0 } }]
      }))
    })
  }
};

// Premium Export Features
const PremiumExportManager = ({ mapData, userTier }) => {
  const [exportFormat, setExportFormat] = useState('WARDLEY_JSON');
  const [customizations, setCustomizations] = useState({});

  const handleExport = async () => {
    if (!userTier.features.includes('advanced_export')) {
      showUpgradeModal('Advanced exports require Starter plan or higher');
      return;
    }

    const exportData = ExportFormats[exportFormat].export(mapData);
    
    // Premium feature: Custom API integrations
    if (exportFormat === 'CUSTOM_API') {
      await syncToCustomAPI(exportData, customizations);
    } else {
      downloadFile(exportData, `${mapData.title}.${exportFormat.toLowerCase()}.json`);
    }
  };

  return (
    <div className="export-manager">
      <h3>Export Options</h3>
      <select value={exportFormat} onChange={(e) => setExportFormat(e.target.value)}>
        <option value="WARDLEY_JSON">Wardley Maps JSON</option>
        <FeatureGate feature="advanced_export" userTier={userTier}>
          <option value="MIRO_JSON">Miro Board</option>
          <option value="FIGMA_JSON">Figma Plugin</option>
          <option value="CUSTOM_API">Custom API</option>
        </FeatureGate>
      </select>
      <button onClick={handleExport}>Export Map</button>
    </div>
  );
};
```

### AI-Powered Usage Analytics
**Track and optimize user engagement**

```javascript
// Usage Analytics with AI Insights
const UsageAnalytics = {
  // Track user interaction patterns
  trackMapCreation: async (mapData, userContext) => {
    const analytics = {
      timestamp: Date.now(),
      mapComplexity: analyzeComplexity(mapData),
      userJourney: userContext.sessionPath,
      aiAssistanceUsed: userContext.aiInteractions,
      completionTime: userContext.sessionDuration
    };

    // AI analysis of user behavior
    if (userTier.features.includes('usage_analytics')) {
      const insights = await usageManager.callWardleyMapsAPI('analytics/user-behavior', {
        analytics,
        generateRecommendations: true
      });

      return {
        ...analytics,
        aiInsights: insights.recommendations,
        improvementSuggestions: insights.suggestions
      };
    }
  },

  // Personalized onboarding
  generatePersonalizedTutorial: async (userProfile) => {
    const tutorial = await usageManager.callWardleyMapsAPI('tutorials/personalized', {
      userRole: userProfile.role,
      experience: userProfile.mappingExperience,
      industry: userProfile.industry
    });

    return tutorial.steps;
  }
};

// Smart Onboarding System
const SmartOnboarding = ({ userProfile }) => {
  const [tutorialSteps, setTutorialSteps] = useState([]);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    if (userTier.features.includes('personalized_onboarding')) {
      UsageAnalytics.generatePersonalizedTutorial(userProfile)
        .then(setTutorialSteps);
    } else {
      setTutorialSteps(defaultTutorialSteps);
    }
  }, [userProfile]);

  return (
    <div className="smart-onboarding">
      <div className="progress-bar">
        <div style={{ width: `${(currentStep / tutorialSteps.length) * 100}%` }} />
      </div>
      {tutorialSteps[currentStep] && (
        <TutorialStep 
          step={tutorialSteps[currentStep]}
          onComplete={() => setCurrentStep(prev => prev + 1)}
        />
      )}
    </div>
  );
};
```

### Integration Hub
**Connect with popular tools and platforms**

```javascript
// Third-party Integration Manager
const IntegrationHub = {
  // Slack Integration
  slack: {
    shareMap: async (mapId, channel) => {
      const mapPreview = await generateMapPreview(mapId);
      await slackAPI.postMessage({
        channel,
        text: `New Wardley Map shared: ${mapData.title}`,
        attachments: [{
          image_url: mapPreview.imageUrl,
          title: mapData.title,
          title_link: `https://create.wardleymaps.ai/#${mapId}`
        }]
      });
    }
  },

  // Notion Integration
  notion: {
    syncToPage: async (mapId, notionPageId) => {
      const mapData = await fetchMap(mapId);
      const jsonExport = ExportFormats.WARDLEY_JSON.export(mapData);
      
      await notionAPI.updatePage({
        page_id: notionPageId,
        properties: {
          "Map Data": { 
            rich_text: [{ text: { content: JSON.stringify(jsonExport, null, 2) } }]
          }
        }
      });
    }
  },

  // Microsoft Teams Integration
  teams: {
    createTab: async (teamId, channelId, mapId) => {
      await teamsAPI.addTab({
        teamId,
        channelId,
        displayName: "Strategy Map",
        teamsAppId: "wardley-maps-app",
        configuration: {
          entityId: mapId,
          contentUrl: `https://create.wardleymaps.ai/teams/${mapId}`,
          websiteUrl: `https://create.wardleymaps.ai/#${mapId}`
        }
      });
    }
  }
};
```

These enhancements address the specific community requests while creating additional premium value opportunities that align perfectly with your monetization strategy.

## AI-Powered Features
**Priority: High**

### Natural Language Map Generation
**Priority: High**

Transform business descriptions and strategic documents into Wardley Maps automatically:

```javascript
// AI Map Generation API
const generateMapFromText = async (businessDescription) => {
  const response = await fetch('/v2/ai/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      description: businessDescription,
      context: 'business_strategy',
      includeEvolution: true,
      suggestLinks: true
    })
  });
  
  const aiResult = await response.json();
  return {
    mapText: aiResult.owmText,
    confidence: aiResult.confidence,
    suggestions: aiResult.alternativeComponents
  };
};

// Example usage
const businessText = `
We run a tea shop that serves customers directly. 
We need cups, tea leaves, and hot water. 
We get hot water from kettles that need power.
The power infrastructure is becoming commoditized.
`;

const generatedMap = await generateMapFromText(businessText);
// Returns OWM syntax ready for the editor
```

**Implementation Features:**
- **Entity Recognition**: Extract components, actors, and capabilities from text
- **Relationship Detection**: Identify dependencies and flows between components  
- **Evolution Assessment**: Suggest maturity levels based on context clues
- **Position Optimization**: Auto-position components for readability

### Intelligent Map Enhancement
**Priority: High**

AI-powered suggestions to improve existing maps:

```javascript
// Map Analysis and Enhancement
const enhanceMap = async (currentMapText) => {
  const analysis = await fetch('/v2/ai/enhance', {
    method: 'POST',
    body: JSON.stringify({ mapText: currentMapText })
  });
  
  return {
    missingComponents: analysis.suggestedComponents,
    evolutionSuggestions: analysis.evolutionAdjustments,
    linkSuggestions: analysis.recommendedLinks,
    strategicInsights: analysis.insights
  };
};

// Enhancement suggestions UI
const showEnhancementPanel = (suggestions) => {
  return (
    <div className="ai-enhancement-panel">
      <h3>AI Suggestions</h3>
      {suggestions.missingComponents.map(component => (
        <div key={component.name} className="suggestion">
          <span>Add component: {component.name}</span>
          <button onClick={() => addComponent(component)}>
            Add to Map
          </button>
        </div>
      ))}
    </div>
  );
};
```

**Enhancement Types:**
- **Missing Components**: Identify gaps in the value chain
- **Evolution Adjustments**: Suggest more accurate maturity positioning
- **Link Optimization**: Recommend missing or incorrect relationships
- **Strategic Patterns**: Detect common Wardley mapping patterns

### Real-Time AI Assistant
**Priority: Medium**

Contextual AI help while editing:

```javascript
// Contextual AI Assistant
const aiAssistant = {
  // Auto-complete component suggestions
  suggestComponent: async (partialName, mapContext) => {
    const suggestions = await fetch('/v2/ai/autocomplete', {
      method: 'POST',
      body: JSON.stringify({ 
        partial: partialName,
        existingComponents: mapContext.components,
        industry: mapContext.domain
      })
    });
    return suggestions.json();
  },

  // Explain positioning
  explainPosition: async (componentName, x, y) => {
    return await fetch('/v2/ai/explain-position', {
      method: 'POST',
      body: JSON.stringify({ component: componentName, evolution: x, visibility: y })
    });
  },

  // Strategic advice
  getStrategicAdvice: async (mapText) => {
    return await fetch('/v2/ai/strategic-advice', {
      method: 'POST',
      body: JSON.stringify({ mapText })
    });
  }
};

// Integration with editor
const EditorWithAI = () => {
  const [aiSuggestions, setAiSuggestions] = useState([]);
  
  const handleTextChange = debounce(async (newText) => {
    const suggestions = await aiAssistant.suggestComponent(
      getCurrentWord(newText), 
      parseMapContext(newText)
    );
    setAiSuggestions(suggestions);
  }, 500);

  return (
    <div className="editor-with-ai">
      <AceEditor onChange={handleTextChange} />
      <AISuggestionsPanel suggestions={aiSuggestions} />
    </div>
  );
};
```

### Map Analysis and Insights
**Priority: Medium**

Deep strategic analysis of maps:

```javascript
// Strategic Analysis Engine
const analyzeStrategy = async (mapText) => {
  const analysis = await fetch('/v2/ai/analyze', {
    method: 'POST',
    body: JSON.stringify({ mapText })
  });
  
  return {
    strengthsWeaknesses: analysis.swot,
    competitiveAdvantage: analysis.moats,
    evolutionPressures: analysis.evolutionForces,
    strategicMoves: analysis.recommendedActions,
    riskAssessment: analysis.risks
  };
};

// Analysis Dashboard
const StrategyDashboard = ({ mapText }) => {
  const [analysis, setAnalysis] = useState(null);
  
  useEffect(() => {
    analyzeStrategy(mapText).then(setAnalysis);
  }, [mapText]);

  return (
    <div className="strategy-dashboard">
      <div className="insights-grid">
        <InsightCard 
          title="Strategic Opportunities" 
          items={analysis?.strategicMoves} 
        />
        <InsightCard 
          title="Evolution Pressures" 
          items={analysis?.evolutionPressures} 
        />
        <InsightCard 
          title="Risk Assessment" 
          items={analysis?.riskAssessment} 
        />
      </div>
    </div>
  );
};
```

### Multi-Modal AI Features
**Priority: Medium**

Expand AI capabilities beyond text:

```javascript
// Image to Map Conversion
const convertImageToMap = async (imageFile) => {
  const formData = new FormData();
  formData.append('image', imageFile);
  
  const response = await fetch('/v2/ai/image-to-map', {
    method: 'POST',
    body: formData
  });
  
  return response.json(); // Returns OWM text
};

// Voice-to-Map
const voiceToMap = async (audioBlob) => {
  const formData = new FormData();
  formData.append('audio', audioBlob);
  
  const response = await fetch('/v2/ai/voice-to-map', {
    method: 'POST',
    body: formData
  });
  
  return response.json();
};

// Document Analysis
const analyzeDocument = async (documentFile) => {
  const formData = new FormData();
  formData.append('document', documentFile);
  
  const response = await fetch('/v2/ai/document-analysis', {
    method: 'POST',
    body: formData
  });
  
  return {
    extractedComponents: response.components,
    suggestedMap: response.owmText,
    keyInsights: response.insights
  };
};
```

### AI Model Integration Options

#### Option 1: OpenAI Integration
```javascript
// OpenAI-powered features
const openAIConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
  temperature: 0.7
};

const generateMapWithOpenAI = async (prompt) => {
  const completion = await openai.chat.completions.create({
    model: openAIConfig.model,
    messages: [
      {
        role: 'system',
        content: `You are an expert in Wardley Mapping. Convert business descriptions into OWM syntax.
        
        OWM Syntax Examples:
        title My Map
        component Customer [0.9, 0.2]
        component Service [0.7, 0.5]
        Customer->Service
        
        Rules:
        - X-axis (first number): evolution (0=genesis, 1=commodity)
        - Y-axis (second number): visibility (0=invisible, 1=visible)
        - Use -> for dependencies
        - Include evolution stages when relevant`
      },
      {
        role: 'user',
        content: prompt
      }
    ],
    temperature: openAIConfig.temperature
  });
  
  return completion.choices[0].message.content;
};
```

#### Option 2: Claude Integration
```javascript
// Anthropic Claude integration
const claudeConfig = {
  apiKey: process.env.ANTHROPIC_API_KEY,
  model: 'claude-3-sonnet-20240229'
};

const enhanceMapWithClaude = async (mapText) => {
  const response = await anthropic.messages.create({
    model: claudeConfig.model,
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: `Analyze this Wardley Map and suggest improvements:

${mapText}

Provide:
1. Missing components that should be included
2. Evolution positioning adjustments
3. Strategic insights and recommendations
4. Potential risks or opportunities

Format your response as structured JSON.`
      }
    ]
  });
  
  return JSON.parse(response.content[0].text);
};
```

#### Option 3: Local/Open Source Models
```javascript
// Local model integration (e.g., Ollama)
const localModelConfig = {
  endpoint: 'http://localhost:11434/api/generate',
  model: 'llama2:13b'
};

const generateWithLocalModel = async (prompt) => {
  const response = await fetch(localModelConfig.endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: localModelConfig.model,
      prompt: prompt,
      stream: false
    })
  });
  
  return response.json();
};
```

### AI Feature UI Components

```javascript
// AI Toolbar Component
const AIToolbar = ({ mapText, onMapUpdate }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  
  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const enhanced = await enhanceMap(mapText);
      onMapUpdate(enhanced.improvedMap);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="ai-toolbar">
      <button 
        onClick={handleGenerate} 
        disabled={isGenerating}
        className="ai-enhance-btn"
      >
        {isGenerating ? '🤖 Analyzing...' : '✨ AI Enhance'}
      </button>
      <button className="ai-generate-btn">
        🧠 Generate from Description
      </button>
      <button className="ai-insights-btn">
        📊 Strategic Insights
      </button>
    </div>
  );
};

// AI Chat Interface
const AIChatAssistant = ({ mapContext }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');

  const sendMessage = async () => {
    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    
    const aiResponse = await fetch('/v2/ai/chat', {
      method: 'POST',
      body: JSON.stringify({
        messages: [...messages, userMessage],
        mapContext
      })
    });
    
    const response = await aiResponse.json();
    setMessages(prev => [...prev, { role: 'assistant', content: response.message }]);
    setInput('');
  };

  return (
    <div className="ai-chat-panel">
      <div className="chat-messages">
        {messages.map((msg, idx) => (
          <div key={idx} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      <div className="chat-input">
        <input 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about your map strategy..."
          onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button onClick={sendMessage}>Send</button>
      </div>
    </div>
  );
};
```

### Implementation Roadmap

#### Phase 1: Basic AI Integration (4-6 weeks)
1. **Text-to-Map Generation**
   - Simple prompt-to-OWM conversion
   - Basic component extraction
   - Integration with OpenAI/Claude API

2. **Map Enhancement Suggestions**
   - Missing component detection
   - Basic improvement recommendations
   - Simple UI integration

#### Phase 2: Advanced AI Features (6-8 weeks)
1. **Real-time AI Assistant**
   - Contextual autocomplete
   - Position explanations
   - Strategic advice chat

2. **Deep Analysis Engine**
   - SWOT analysis
   - Strategic move recommendations
   - Risk assessment

#### Phase 3: Multi-Modal AI (8-12 weeks)
1. **Document Processing**
   - PDF/Word document analysis
   - Image-to-map conversion
   - Voice interface

2. **Advanced Analytics**
   - Pattern recognition across maps
   - Industry benchmark comparisons
   - Predictive insights

### Technical Architecture

```javascript
// AI Service Architecture
class AIService {
  constructor(config) {
    this.models = {
      text: new TextGenerationModel(config.textModel),
      analysis: new AnalysisModel(config.analysisModel),
      vision: new VisionModel(config.visionModel)
    };
  }

  async generateMap(prompt) {
    const result = await this.models.text.generate({
      prompt: this.buildMapPrompt(prompt),
      maxTokens: 1000
    });
    
    return this.validateOWMSyntax(result);
  }

  async enhanceMap(mapText) {
    const analysis = await this.models.analysis.analyze(mapText);
    return this.formatEnhancements(analysis);
  }

  buildMapPrompt(userInput) {
    return `
    Convert this business description to Wardley Map syntax:
    ${userInput}
    
    Use OWM format with proper evolution and visibility positioning.
    `;
  }

  validateOWMSyntax(generatedText) {
    // Validate against Converter.js rules
    try {
      new Converter().parse(generatedText);
      return { valid: true, text: generatedText };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }
}
```

### Success Metrics for AI Features

- **Adoption Rate**: % of users trying AI features
- **Generation Accuracy**: User acceptance rate of AI-generated maps
- **Enhancement Value**: % of AI suggestions implemented
- **Time Savings**: Reduction in map creation time
- **User Satisfaction**: Ratings for AI-generated content
- **Engagement**: Frequency of AI feature usage

## Export and Integration

### Enhanced Export Options
**Priority: Medium**

1. **Multiple Format Support**
   - Vector formats (SVG, PDF, EPS)
   - High-resolution raster formats
   - Interactive HTML exports
   - PowerPoint/Google Slides integration

2. **Batch Operations**
   - Bulk export of map collections
   - Automated report generation
   - Scheduled export jobs

3. **Custom Styling**
   - Theme editor for custom styles
   - Brand-specific color schemes
   - Logo and watermark support

### Third-Party Integrations
**Priority: Low-Medium**

1. **Documentation Platforms**
   - Confluence integration
   - Notion embed support
   - GitBook plugin

2. **Project Management Tools**
   - Jira integration for strategy tracking
   - Trello board generation
   - Asana task creation from components

3. **Business Intelligence**
   - Export to BI tools (Tableau, Power BI)
   - Data warehouse integration
   - Metrics dashboard creation

## User Experience Improvements

### Onboarding and Help
**Priority: Medium**

1. **Interactive Tutorials**
   - Step-by-step map creation guide
   - Interactive examples and exercises
   - Context-sensitive help system

2. **Learning Resources**
   - Video tutorials integration
   - Best practice examples
   - Community map gallery

3. **Progressive Disclosure**
   - Beginner/Advanced mode toggle
   - Feature discovery system
   - Customizable interface complexity

### Accessibility and Performance
**Priority: High**

1. **Accessibility Improvements**
   - Screen reader support
   - Keyboard navigation
   - High contrast mode
   - Font size scaling

2. **Performance Optimization**
   - Virtual scrolling for large maps
   - Progressive loading
   - Background sync for saves
   - Offline mode support

3. **Mobile Responsiveness**
   - Touch-optimized interface
   - Mobile-specific gestures
   - Responsive map rendering

## Infrastructure and Development

### Serverless Migration Options
**Priority: High**

Transform the application from traditional server-based architecture to serverless for improved scalability, reduced costs, and global performance.

**Current Architecture Analysis:**
- **Frontend**: React SPA deployed on Vercel at `create.wardleymaps.ai` (already serverless)
- **API**: REST endpoints at `maps.wardleymaps.ai` hosted on Cloudflare 
- **Data**: Text-based maps + metadata (lightweight, perfect for serverless)
- **Current Setup**: Frontend on Vercel, API on Cloudflare infrastructure

#### Option 1: Cloudflare Workers + D1 (Recommended)
**Best for: Existing Cloudflare API hosting and global performance**

```javascript
// worker.js - Main API handler
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === '/v2/maps/save' && request.method === 'POST') {
      return handleSave(request, env);
    }
    
    if (path === '/v2/maps/fetch' && request.method === 'GET') {
      return handleFetch(request, env);
    }
    
    if (path === '/v2/ai/generate' && request.method === 'POST') {
      return handleAIGenerate(request, env);
    }
    
    return new Response('Not Found', { status: 404 });
  }
};

async function handleSave(request, env) {
  const { id, text, meta } = await request.json();
  
  const stmt = env.DB.prepare(`
    INSERT OR REPLACE INTO maps (id, text, meta, updated_at) 
    VALUES (?, ?, ?, ?)
  `);
  
  await stmt.bind(id, text, meta, Date.now()).run();
  return Response.json({ id, success: true });
}

async function handleAIGenerate(request, env) {
  const { description } = await request.json();
  
  const aiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${env.OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [
        { role: 'system', content: 'Convert business descriptions to Wardley Map OWM syntax...' },
        { role: 'user', content: description }
      ]
    })
  });
  
  const result = await aiResponse.json();
  return Response.json({ mapText: result.choices[0].message.content });
}
```

**Database Schema (D1 SQLite):**
```sql
CREATE TABLE maps (
  id TEXT PRIMARY KEY,
  text TEXT NOT NULL,
  meta TEXT,
  user_id TEXT,
  created_at INTEGER DEFAULT (strftime('%s', 'now')),
  updated_at INTEGER DEFAULT (strftime('%s', 'now'))
);

CREATE INDEX idx_maps_updated ON maps(updated_at);
CREATE INDEX idx_maps_user ON maps(user_id);
```

**Benefits:**
- Runs on 300+ global edge locations
- Sub-50ms latency worldwide
- SQLite-compatible D1 database
- Extremely cost effective (~$0-5/month)
- Natural migration from existing Cloudflare API hosting
- Built-in DDoS protection

#### Option 2: Vercel + Edge Functions (Easiest Migration)
**Best for: Keeping everything in Vercel ecosystem where frontend is already hosted**

```javascript
// api/maps/save.js
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id, text, meta } = req.body;
  
  // Store in Vercel KV or external database
  await kv.set(`map:${id}`, { 
    text, 
    meta, 
    updated: Date.now() 
  });
  
  return res.json({ id, success: true });
}

// api/ai/generate.js
export default async function handler(req, res) {
  const { description } = req.body;
  
  const completion = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'Convert to OWM syntax...' },
      { role: 'user', content: description }
    ]
  });
  
  return res.json({ 
    mapText: completion.choices[0].message.content 
  });
}
```

**Benefits:**
- Zero configuration deployment (frontend already on Vercel)
- Unified platform for frontend and API
- Global edge network
- Built-in caching and CDN
- Automatic scaling
- Free tier for moderate usage
- Simplest migration path since frontend is already on Vercel

#### Option 3: AWS Lambda + API Gateway
**Best for: Enterprise features and AWS ecosystem**

```javascript
// serverless.yml
service: wardley-maps-api

provider:
  name: aws
  runtime: nodejs18.x
  environment:
    DYNAMODB_TABLE: ${self:service}-${opt:stage}
    OPENAI_API_KEY: ${env:OPENAI_API_KEY}

functions:
  saveMap:
    handler: handlers/maps.save
    events:
      - http:
          path: maps/save
          method: post
          cors: true
  
  generateMap:
    handler: handlers/ai.generate
    events:
      - http:
          path: ai/generate
          method: post
          cors: true

resources:
  Resources:
    MapsTable:
      Type: AWS::DynamoDB::Table
      Properties:
        TableName: ${self:provider.environment.DYNAMODB_TABLE}
        AttributeDefinitions:
          - AttributeName: id
            AttributeType: S
        KeySchema:
          - AttributeName: id
            KeyType: HASH
        BillingMode: PAY_PER_REQUEST
```

**Benefits:**
- Full AWS ecosystem integration
- Advanced monitoring with CloudWatch
- VPC integration available
- Fine-grained IAM controls
- Integration with other AWS services

#### Option 4: Supabase (Backend-as-a-Service)
**Best for: Rapid development with built-in auth**

```javascript
// lib/supabase.js
import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
)

// Enhanced API with user authentication
export const saveMap = async (id, text, meta) => {
  const { data: { user } } = await supabase.auth.getUser()
  
  const { data, error } = await supabase
    .from('maps')
    .upsert({ 
      id, 
      text, 
      meta, 
      user_id: user?.id,
      updated_at: new Date() 
    })
    .select()
  
  if (error) throw error
  return data[0]
}

export const generateMapWithAI = async (description) => {
  const { data, error } = await supabase.functions.invoke('generate-map', {
    body: { description }
  })
  
  if (error) throw error
  return data
}
```

**Benefits:**
- Built-in authentication system
- Real-time subscriptions
- PostgreSQL database with JSON support
- Row-level security
- Auto-generated APIs
- Built-in file storage for images

### Migration Strategy

Given your current setup (Vercel frontend + Cloudflare API), you have two optimal paths:

#### Path A: Full Vercel Migration (Simplest)
**Timeline: 1-2 weeks**
1. **Add Vercel Functions**: Create `/api` folder in existing Vercel project
2. **Implement API endpoints**: Move existing API logic to Vercel functions
3. **Database Setup**: Use Vercel KV or external database (Supabase/PlanetScale)
4. **Update Config**: Change `ApiEndpoint` to relative `/api/maps/`
5. **Gradual Migration**: Test with subset of users before full switch

#### Path B: Enhanced Cloudflare Migration (More Advanced)
**Timeline: 2-3 weeks**
1. **Migrate to Workers**: Convert existing Cloudflare API to Workers + D1
2. **Keep Vercel Frontend**: No changes needed to deployment
3. **Enhanced Features**: Add AI endpoints and advanced caching
4. **Performance Optimization**: Leverage edge computing fully
5. **Future-Proof**: Better foundation for enterprise features

#### Phase 2: Enhanced Features (3-4 weeks)
1. **Add AI Endpoints**: Integrate OpenAI/Claude APIs
2. **Authentication**: Implement user accounts and privacy
3. **Real-time Features**: WebSocket support for collaboration
4. **Advanced Analytics**: Usage tracking and insights
5. **Performance Optimization**: Edge caching strategies

#### Phase 3: Advanced Capabilities (4-6 weeks)
1. **Multi-Modal AI**: Image and voice processing
2. **GitHub Integration**: Serverless Git operations
3. **Export Services**: Server-side image generation
4. **Enterprise Features**: Team management, advanced auth

### Code Changes Required

**Frontend Changes for Each Path:**

**Path A: Vercel Migration (Simplest)**
```javascript
// src/constants/defaults.js
export const ApiEndpoint = '/api/maps/'; // Relative path for same domain

// Optional: Environment-specific configs
export const getApiEndpoint = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:3000/api/maps/'; // Local Vercel dev
  }
  return '/api/maps/'; // Same domain as frontend
};
```

**Path B: Cloudflare Workers Migration**
```javascript
// src/constants/defaults.js  
export const ApiEndpoint = 'https://api.wardleymaps.ai/v2/maps/'; // New Workers domain

// Optional: Environment-specific configs
export const getApiEndpoint = () => {
  if (process.env.NODE_ENV === 'development') {
    return 'http://localhost:8787/v2/maps/'; // Local Wrangler dev
  }
  return 'https://api.wardleymaps.ai/v2/maps/';
};
```

**Enhanced Error Handling:**
```javascript
// Enhanced save function with retry logic
const saveToRemoteStorage = async function(hash) {
  const maxRetries = 3;
  let attempt = 0;
  
  while (attempt < maxRetries) {
    try {
      const response = await fetch(Defaults.ApiEndpoint + 'save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({ id: hash, text: mapText, meta: metaText }),
      });
      
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      
      const data = await response.json();
      window.location.hash = '#' + data.id;
      setCurrentUrl(window.location.href);
      setSaveOutstanding(false);
      return;
      
    } catch (error) {
      attempt++;
      if (attempt >= maxRetries) {
        setCurrentUrl('(could not save map, please try again)');
        console.error('Save failed after retries:', error);
      } else {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
};
```

### Serverless Benefits

#### Cost Optimization
- **Current**: Fixed server costs regardless of usage
- **Serverless**: Pay only for actual requests and compute time
- **Estimated Savings**: 60-80% reduction in infrastructure costs
- **Free Tiers**: Most platforms offer generous free tiers

#### Performance Improvements
- **Global Distribution**: Functions run closer to users
- **Auto-scaling**: Handle traffic spikes automatically
- **Cold Start Optimization**: Modern runtimes minimize latency
- **Edge Caching**: Automatic caching at CDN level

#### Operational Benefits
- **Zero Server Management**: No OS updates, security patches
- **Automatic Scaling**: Scale to zero when not in use
- **Built-in Monitoring**: Platform-provided metrics and logging
- **Disaster Recovery**: Built-in redundancy and failover

#### Development Velocity
- **Faster Deployments**: Git-based deployments in seconds
- **Environment Parity**: Development/staging/production consistency
- **Feature Flags**: Easy A/B testing and gradual rollouts
- **Version Management**: Built-in versioning and rollback

### Development Experience
**Priority: Medium**

1. **Component Library**
   - Storybook documentation expansion
   - Design system implementation
   - Reusable component packages

2. **Testing Infrastructure**
   - Visual regression testing
   - End-to-end test automation
   - Performance monitoring
   - Serverless function testing

3. **Development Tools**
   - Hot module replacement
   - Better debugging tools
   - Development analytics
   - Local serverless development

### Deployment and Operations
**Priority: Medium**

1. **Multi-Environment Support**
   - Staging environment on serverless
   - Feature flag system
   - A/B testing framework
   - Environment-specific configurations

2. **Monitoring and Analytics**
   - User behavior tracking
   - Performance monitoring
   - Error reporting and alerting
   - Serverless function metrics

3. **Scalability Improvements**
   - Edge computing optimization
   - Database connection pooling
   - Serverless architecture patterns
   - Global content distribution

## Security and Privacy

### Data Protection
**Priority: High**

1. **Privacy Controls**
   - Granular sharing permissions
   - Data retention policies
   - GDPR compliance features

2. **Security Enhancements**
   - Two-factor authentication
   - API rate limiting
   - Content Security Policy
   - Regular security audits

3. **Data Ownership**
   - User data export tools
   - Account deletion procedures
   - Data portability features

## Terminology Updates (EVTP Branch)

### Attitude Components Terminology Change
**Priority: Medium**

The EVTP branch contains a comprehensive terminology update to make Wardley mapping concepts more accessible and intuitive:

**Changes:**
- `pioneers` → `explorers`
- `settlers` → `villagers` 
- `townplanners` remains unchanged

**Files Modified:**
- `src/conversion/AttitudeExtractionStrategy.js` - Updated base strategies array
- `src/conversion/LinksExtractionStrategy.js` - Updated excluded keywords list
- `src/migrations/AttitudesMigrationStrategy.js` - Updated migration logic
- `src/constants/mapstyles.js` - Updated style property names
- `src/constants/usages.js` - Updated help text and examples
- `src/constants/editorPrefixes.js` - Updated autocomplete keywords
- `public/mode-owm.js` - Updated syntax highlighting regex
- Documentation and blog posts updated
- Test cases and snapshots updated

**Implementation Example:**
```javascript
// Before (pioneers/settlers/townplanners)
const attitudes = ['pioneers', 'settlers', 'townplanners'];

// After (explorers/villagers/townplanners)  
const attitudes = ['explorers', 'villagers', 'townplanners'];

// Map syntax change
// Before:
pioneers [0.95, 0.83] 120 30
settlers [0.88, 0.83] 120 30

// After:
explorers [0.95, 0.83] 120 30
villagers [0.88, 0.83] 120 30
```

**Migration Strategy:**
- Implement automatic migration for existing maps
- Maintain backward compatibility during transition
- Update documentation and tutorials
- Notify users of terminology changes

**Benefits:**
- More intuitive and accessible language
- Clearer understanding for new users
- Maintains the same conceptual framework
- Easier to explain and teach

## Implementation Priorities

### Phase 1 (Immediate - 2-4 weeks)
- **Serverless Migration**: Choose between Vercel unification (1-2 weeks) or Cloudflare Workers enhancement (2-3 weeks)
- **AI Features**: Basic text-to-map generation and enhancement suggestions
- **Terminology Update**: Implement EVTP branch changes (explorers/villagers)
- GitHub Gists integration
- Basic server-side image generation
- Accessibility improvements
- Performance optimizations

### Phase 2 (Short-term - 1-3 months)
- **Serverless Enhancement**: Add authentication, real-time features, advanced analytics on chosen platform
- **AI Features**: Real-time assistant, strategic analysis dashboard
- **Enhanced Editor Features**: 
  - Rich component descriptions and metadata
  - Double-click inline editing
  - Multiple coordinate system support
  - TOML-compliant map format
- **Advanced Export/Import**: JSON, TOML, and API integrations
- Advanced GitHub integration
- User experience improvements

### Phase 3 (Medium-term - 3-6 months)
- **Serverless Advanced**: Multi-modal AI processing, enterprise features
- **AI Features**: Multi-modal capabilities, document processing
- **Advanced Mapping**: 
  - Social good and ESG impact analysis
  - Multiple map view systems (Cynefin, Stacey Matrix)
  - Advanced annotation and labeling systems
- **Enterprise Integrations**: Jira, Miro, Confluence sync
- Analytics and intelligence
- Third-party integrations
- Advanced collaboration tools

### Phase 4 (Long-term - 6+ months)
- **AI Features**: Industry benchmarks, predictive insights
- **Serverless Enterprise**: Team management, advanced security, custom deployments
- Advanced security features
- Enterprise-grade features
- Global edge optimization

## Success Metrics

### User Engagement
- Map creation frequency
- Collaboration session duration
- Feature adoption rates
- User retention metrics

### Technical Performance
- Page load times
- API response times
- Error rates
- System availability

### Business Impact
- User growth rate
- Premium feature conversion
- Community engagement
- Enterprise adoption

---

*This document should be regularly updated as new enhancement opportunities are identified and priorities shift based on user feedback and business requirements.*