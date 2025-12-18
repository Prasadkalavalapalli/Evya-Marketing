import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// API Configuration - Replace with your actual API endpoint
const API_BASE_URL = 'https://marketing.evyaa.com/api';


const MarketingTrackerApp = () => {
  // State management
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'pending', 'completed', 'followup', 'cancelled'
  const [currentEntry, setCurrentEntry] = useState({
    id: null,
    date: new Date().toISOString().split('T')[0],
    companyName: '',
    contacts: [{ phone: '', email: '', contactName: '', notes: '' }],
    address: '',
    latitude: '',
    longitude: '',
    reminder: '',
    status: 'pending',
    notes: ''
  });
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [viewMode, setViewMode] = useState('list'); // 'list', 'form', 'view'
   const [isInWebView, setIsInWebView] = useState(false);
  // Your branding colors
  const colors = {
    black: '#000000',
    white: '#FFFFFF',
    grey: '#9E9E9E',
    lightgrey: '#FAFAFA',
    mediumgrey: '#D8D8D8',
    primary: '#4AAF57',
    secondary: '#12D18E14'
  };

  // Logo component - Replace with your actual logo
  const AppLogo = () => (
    <div className="app-logo">
      <div className="logo-icon" style={{ backgroundColor: colors.primary }}>
        {/* <span style={{ color: colors.white }}>M</span> */}
        <img   className="logo-icon"  src='./logov.png' alt='logo'/>
      </div>
      <span className="logo-text" style={{ color: colors.black }}>
         Evya Marketing
      </span>
    </div>
  );

  // Calculate counts for each status
  const getStatusCounts = () => {
    return {
      all: entries.length,
      pending: entries.filter(e => e.status === 'pending').length,
      completed: entries.filter(e => e.status === 'completed').length,
      followup: entries.filter(e => e.status === 'followup').length,
      cancelled: entries.filter(e => e.status === 'cancelled').length
    };
  };

  // Get filtered entries based on active tab
  const getFilteredEntries = () => {
    if (activeTab === 'all') return entries;
    return entries.filter(entry => entry.status === activeTab);
  };

  const statusCounts = getStatusCounts();
  const filteredEntries = getFilteredEntries();

  // API Functions
  const fetchEntries = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE_URL}/field-visits`);
      console.log(response.data);
      setEntries(response.data);
    } catch (error) {
      console.error('Error fetching entries:', error);
      showToastMessage('Failed to load entries. Please try again.');
      // Fallback to empty array
      setEntries([]);
    } finally {
      setLoading(false);
    }
  };

  const saveEntry = async (entryData) => {
    try {
      if (editingId) {
        // Update existing entry
        await axios.put(`${API_BASE_URL}/field-visits/${editingId}`, entryData);
        showToastMessage('Entry updated successfully!');
      } else {
        // Create new entry
        await axios.post(`${API_BASE_URL}/field-visits`, entryData);
        showToastMessage('Entry added successfully!');
      }
      fetchEntries(); // Refresh the list
      return true;
    } catch (error) {
      console.error('Error saving entry:', error);
      showToastMessage('Failed to save entry. Please try again.');
      return false;
    }
  };

  const deleteEntry = async (id) => {
    try {
      await axios.delete(`${API_BASE_URL}/field-visits/${id}`);
      showToastMessage('Entry deleted successfully!');
      fetchEntries(); // Refresh the list
    } catch (error) {
      console.error('Error deleting entry:', error);
      showToastMessage('Failed to delete entry. Please try again.');
    }
  };

  // Load data from API on component mount
  useEffect(() => {
    fetchEntries();
  }, []);


// CHANGE THIS useEffect:
useEffect(() => {
  if (window.ReactNativeWebView) {
    setIsInWebView(true);
    console.log('Running in React Native WebView');
    
    // Use document.addEventListener instead of window
    const handleNativeMessage = (event) => {
      try {
        console.log('DEBUG: Message received:', event.data);
        const data = JSON.parse(event.data);
        
        if (data.type === 'locationUpdate') {
          // Location received from React Native
          const { latitude, longitude, address } = data;
          
          setCurrentEntry(prev => ({
            ...prev,
            latitude: latitude,
            longitude: longitude,
            address: address || `Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
          }));
          
          showToastMessage('Location captured!');
          
          // Get detailed address
          if (latitude && longitude) {
            fetchAddressFromCoordinates(latitude, longitude);
          }
        }
        
        if (data.type === 'locationError') {
          showToastMessage(data.error || 'Failed to get location');
        }
      } catch (error) {
        console.error('Error parsing native message:', error);
      }
    };
    
    // ✅ CORRECT: Use document instead of window
    document.addEventListener('message', handleNativeMessage);
    
    // Cleanup
    return () => {
      document.removeEventListener('message', handleNativeMessage);
    };
  }
}, []);

// CHANGE THIS getCurrentLocation function:
const getCurrentLocation = () => {
  // If in WebView, request location from React Native
  if (window.ReactNativeWebView) {
    console.log('DEBUG: In WebView, requesting location');
    showToastMessage('Requesting location...');
    
    // Send message to React Native
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'requestLocation',
      timestamp: Date.now()
    }));
    
    return;
  }
  
  // Regular browser geolocation (for web app)
  if (!navigator.geolocation) {
    showToastMessage('Geolocation is not supported by your browser.');
    return;
  }
  
  showToastMessage('Requesting location permission...');
  
  // Show permission dialog to user
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      
      setCurrentEntry(prev => ({
        ...prev,
        latitude: latitude,
        longitude: longitude,
        address: `Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
      }));
      
      showToastMessage('Location captured! Getting address...');
      
      // Get detailed address from coordinates
      await fetchAddressFromCoordinates(latitude, longitude);
    },
    (error) => {
      console.error('Geolocation error:', error);
      
      let errorMessage = 'Failed to get location';
      
      switch(error.code) {
        case error.PERMISSION_DENIED:
          errorMessage = 'Location permission denied. Please allow location access in your browser settings.';
          
          // Show helpful instructions
          setTimeout(() => {
            // if (confirm('To enable location:\n1. Click the lock icon in address bar\n2. Click "Site settings"\n3. Allow "Location"\n\nOpen instructions?')) {
            //   window.open('https://support.google.com/chrome/answer/142065?hl=en', '_blank');
            // }
          }, 1000);
          break;
          
        case error.POSITION_UNAVAILABLE:
          errorMessage = 'Location information is unavailable. Please check if location services are enabled on your device.';
          break;
          
        case error.TIMEOUT:
          errorMessage = 'Location request timed out. Please try again.';
          break;
          
        default:
          errorMessage = 'An unknown error occurred while getting location.';
      }
      
      showToastMessage(errorMessage);
    },
    { 
      enableHighAccuracy: true,  // Use GPS if available
      timeout: 15000,           // Wait 15 seconds
      maximumAge: 0             // Don't use cached location
    }
  );
};
// Add this helper function
const fetchAddressFromCoordinates = async (latitude, longitude) => {
  try {
    const response = await axios.get(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
    );
    
    if (response.data && response.data.display_name) {
      setCurrentEntry(prev => ({
        ...prev,
        address: response.data.display_name
      }));
      showToastMessage('Address captured successfully!');
    }
  } catch (error) {
    console.error('Error fetching address:', error);
  }
};
  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setCurrentEntry({
      ...currentEntry,
      [name]: value
    });
  };

  // Handle contact field changes
  const handleContactChange = (index, field, value) => {
    const updatedContacts = [...currentEntry.contacts];
    updatedContacts[index][field] = value;
    setCurrentEntry({
      ...currentEntry,
      contacts: updatedContacts
    });
  };

  // Add new contact field
  const addContact = () => {
    setCurrentEntry({
      ...currentEntry,
      contacts: [...currentEntry.contacts, { phone: '', email: '', contactName: '', notes: '' }]
    });
  };

  // Remove contact field
  const removeContact = (index) => {
    if (currentEntry.contacts.length > 1) {
      const updatedContacts = [...currentEntry.contacts];
      updatedContacts.splice(index, 1);
      setCurrentEntry({
        ...currentEntry,
        contacts: updatedContacts
      });
    }
  };

  // Show toast message
  const showToastMessage = (message) => {
    setToastMessage(message);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const entryToSave = {
      ...currentEntry,
      id: editingId || undefined, // Let API generate ID for new entries
      date: currentEntry.date || new Date().toISOString().split('T')[0],
      // createdAt: editingId ? currentEntry.createdAt : new Date().toISOString(),
      // updatedAt: new Date().toISOString()
    };

    const success = await saveEntry(entryToSave);
    
    if (success) {
      // Reset form
      setCurrentEntry({
        id: null,
        date: new Date().toISOString().split('T')[0],
        companyName: '',
        contacts: [{ phone: '', email: '', contactName: '', notes: '' }],
        address: '',
        latitude: '',
        longitude: '',
        reminder: '',
        status: 'pending',
        notes: ''
      });
      setEditingId(null);
      setViewMode('list');
    }
  };

  // Edit an entry
  const handleEdit = (entry) => {
    setCurrentEntry(entry);
    setEditingId(entry.id);
    setViewMode('form');
  };

  // View an entry
  const handleView = (entry) => {
    setCurrentEntry(entry);
    setViewMode('view');
  };

  // Delete an entry
  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this entry?')) {
      deleteEntry(id);
    }
  };

  // Status badge color
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return colors.primary;
      case 'pending': return '#FFA500';
      case 'followup': return '#4299E1';
      case 'cancelled': return '#FF6B6B';
      default: return colors.grey;
    }
  };

  // Render Status Tabs
  const renderStatusTabs = () => (
    <div className="status-tabs-container">
      <div className="status-tabs">
        <button
          className={`status-tab ${activeTab === 'all' ? 'active' : ''}`}
          onClick={() => setActiveTab('all')}
          style={{
            backgroundColor: activeTab === 'all' ? colors.primary : colors.white,
            color: activeTab === 'all' ? colors.white : colors.black,
            borderColor: colors.mediumgrey
          }}
        >
          <div className="tab-count">{statusCounts.all}</div>
          <div className="tab-label">All</div>
        </button>
        
        <button
          className={`status-tab ${activeTab === 'pending' ? 'active' : ''}`}
          onClick={() => setActiveTab('pending')}
          style={{
            backgroundColor: activeTab === 'pending' ? '#FFA500' : colors.white,
            color: activeTab === 'pending' ? colors.white : colors.black,
            borderColor: colors.mediumgrey
          }}
        >
          <div className="tab-count">{statusCounts.pending}</div>
          <div className="tab-label">Pending</div>
        </button>
        
        <button
          className={`status-tab ${activeTab === 'completed' ? 'active' : ''}`}
          onClick={() => setActiveTab('completed')}
          style={{
            backgroundColor: activeTab === 'completed' ? colors.primary : colors.white,
            color: activeTab === 'completed' ? colors.white : colors.black,
            borderColor: colors.mediumgrey
          }}
        >
          <div className="tab-count">{statusCounts.completed}</div>
          <div className="tab-label">Completed</div>
        </button>
        
        <button
          className={`status-tab ${activeTab === 'followup' ? 'active' : ''}`}
          onClick={() => setActiveTab('followup')}
          style={{
            backgroundColor: activeTab === 'followup' ? '#4299E1' : colors.white,
            color: activeTab === 'followup' ? colors.white : colors.black,
            borderColor: colors.mediumgrey
          }}
        >
          <div className="tab-count">{statusCounts.followup}</div>
          <div className="tab-label">Follow-up</div>
        </button>
        
        <button
          className={`status-tab ${activeTab === 'cancelled' ? 'active' : ''}`}
          onClick={() => setActiveTab('cancelled')}
          style={{
            backgroundColor: activeTab === 'cancelled' ? '#FF6B6B' : colors.white,
            color: activeTab === 'cancelled' ? colors.white : colors.black,
            borderColor: colors.mediumgrey
          }}
        >
          <div className="tab-count">{statusCounts.cancelled}</div>
          <div className="tab-label">Closed</div>
        </button>
      </div>
    </div>
  );

  // Render the contact form
  const renderForm = () => (
    <div className="mobile-form-container">
      <div className="mobile-header" style={{ backgroundColor: colors.primary }}>
        <button 
          className="mobile-back-btn" 
          onClick={() => setViewMode('list')}
          style={{ color: colors.white }}
        >
          ←
        </button>
        <AppLogo />
        <div className="header-title" style={{ color: colors.white }}>
          {editingId ? 'Edit Visit' : 'New Visit'}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-container">
        <div className="mobile-form-scroll">
          {/* Auto-filled Date */}
          <div className="form-group">
            <label style={{ color: colors.black }}>Date</label>
            <input
              type="date"
              name="date"
              value={currentEntry.date}
              onChange={handleInputChange}
              required
              className="form-input"
              style={{
                borderColor: colors.mediumgrey,
                backgroundColor: colors.white
              }}
            />
          </div>

          {/* Company Name */}
          <div className="form-group">
            <label style={{ color: colors.black }}>Company Name</label>
            <input
              type="text"
              name="companyName"
              value={currentEntry.companyName}
              onChange={handleInputChange}
              placeholder="Enter company name"
              required
              className="form-input"
              style={{
                borderColor: colors.mediumgrey,
                backgroundColor: colors.white
              }}
            />
          </div>

          {/* Status */}
          <div className="form-group">
            <label style={{ color: colors.black }}>Status</label>
            <select
              name="status"
              value={currentEntry.status}
              onChange={handleInputChange}
              className="form-input"
              required
              style={{
                borderColor: colors.mediumgrey,
                backgroundColor: colors.white
              }}
            >
              <option value="pending">Pending</option>
              <option value="completed">Completed</option>
              <option value="followup">Follow-up</option>
              <option value="cancelled">Closed/Rejected</option>
            </select>
          </div>

          {/* Reminder */}
          <div className="form-group">
            <label style={{ color: colors.black }}>Reminder</label>
            <input
              type="date"
              name="reminder"
              value={currentEntry.reminder}
              onChange={handleInputChange}
              className="form-input"
              style={{
                borderColor: colors.mediumgrey,
                backgroundColor: colors.white
              }}
            />
          </div>

          {/* Address & Location */}
          <div className="form-group">
            <label style={{ color: colors.black }}>Location</label>
            <div className="location-group">
              <button 
                type="button" 
                onClick={getCurrentLocation}
                className="mobile-location-btn"
                style={{
                  backgroundColor: colors.primary,
                  color: colors.white
                }}
              >
                📍 Get Current Location
              </button>
            </div>
            {currentEntry.address && (
              <div className="address-display" style={{ 
                color: colors.black,
                backgroundColor: colors.secondary,
                padding: '12px',
                borderRadius: '8px',
                marginTop: '10px',
                fontSize: '14px',
                lineHeight: '1.5'
              }}>
                <strong>Address:</strong> {currentEntry.address}
              </div>
            )}
          </div>

          {/* Contacts Section */}
          <div className="contacts-section">
            <div className="section-header">
              <h3 style={{ color: colors.black }}>Contacts</h3>
              <button 
                type="button" 
                onClick={addContact} 
                className="mobile-add-btn"
                style={{
                  backgroundColor: colors.secondary,
                  color: colors.primary
                }}
              >
                + Add Contact
              </button>
            </div>
            
            {currentEntry.contacts.map((contact, index) => (
              <div key={index} className="contact-card" style={{ borderColor: colors.mediumgrey }}>
                <div className="contact-header">
                  <h4 style={{ color: colors.black }}>Contact {index + 1}</h4>
                  {currentEntry.contacts.length > 1 && (
                    <button 
                      type="button" 
                      onClick={() => removeContact(index)}
                      className="mobile-remove-btn"
                      style={{ color: colors.grey }}
                    >
                      Remove
                    </button>
                  )}
                </div>
                
                <div className="contact-fields">
                  <div className="form-group">
                    <input
                      type="text"
                      value={contact.contactName}
                      onChange={(e) => handleContactChange(index, 'contactName', e.target.value)}
                      placeholder="Contact Name"
                      className="form-input"
                      style={{
                        borderColor: colors.mediumgrey,
                        backgroundColor: colors.white
                      }}
                    />
                  </div>
                  
                  <div className="form-group">
                    <input
                      type="tel"
                      value={contact.phone}
                      onChange={(e) => handleContactChange(index, 'phone', e.target.value)}
                      placeholder="Phone Number"
                      className="form-input"
                      style={{
                        borderColor: colors.mediumgrey,
                        backgroundColor: colors.white
                      }}
                    />
                  </div>
                  
                  <div className="form-group">
                    <input
                      type="email"
                      value={contact.email}
                      onChange={(e) => handleContactChange(index, 'email', e.target.value)}
                      placeholder="Email Address"
                      className="form-input"
                      style={{
                        borderColor: colors.mediumgrey,
                        backgroundColor: colors.white
                      }}
                    />
                  </div>
                  
                  <div className="form-group">
                    <textarea
                      value={contact.notes}
                      onChange={(e) => handleContactChange(index, 'notes', e.target.value)}
                      placeholder="Contact Notes"
                      className="form-input"
                      rows="2"
                      style={{
                        borderColor: colors.mediumgrey,
                        backgroundColor: colors.white
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* General Notes */}
          <div className="form-group">
            <label style={{ color: colors.black }}>General Notes</label>
            <textarea
              name="notes"
              value={currentEntry.notes}
              onChange={handleInputChange}
              placeholder="Enter any additional notes about the visit"
              className="form-input"
              rows="4"
              style={{
                borderColor: colors.mediumgrey,
                backgroundColor: colors.white
              }}
            />
          </div>
        </div>

        {/* Fixed Submit Button */}
        <div className="mobile-form-actions">
          <button 
            type="submit" 
            className="mobile-submit-btn"
            style={{
              backgroundColor: colors.primary,
              color: colors.white
            }}
          >
            {editingId ? 'UPDATE VISIT' : 'SAVE VISIT'}
          </button>
        </div>
      </form>
    </div>
  );

  // Render entry details view
  const renderView = () => (
    <div className="mobile-view-container">
      <div className="mobile-header" style={{ backgroundColor: colors.primary }}>
        <button 
          className="mobile-back-btn" 
          onClick={() => setViewMode('list')}
          style={{ color: colors.white }}
        >
          ←
        </button>
        <AppLogo />
        <button 
          className="mobile-edit-btn" 
          onClick={() => handleEdit(currentEntry)}
          style={{ color: colors.white }}
        >
          Edit
        </button>
      </div>

      <div className="mobile-view-scroll">
        <div className="view-card">
          <div className="view-section">
            <div className="view-row">
              <div className="view-label" style={{ color: colors.grey }}>Date</div>
              <div className="view-value" style={{ color: colors.black }}>{currentEntry.visitDate}</div>
            </div>
            <div className="view-row">
              <div className="view-label" style={{ color: colors.grey }}>Company</div>
              <div className="view-value" style={{ color: colors.black }}>{currentEntry.companyName}</div>
            </div>
            <div className="view-row">
              <div className="view-label" style={{ color: colors.grey }}>Status</div>
              <div className="view-value">
                <span 
                  className="mobile-status-badge"
                  style={{ 
                    backgroundColor: getStatusColor(currentEntry.status) + '20',
                    color: getStatusColor(currentEntry.status)
                  }}
                >
                  {currentEntry.status}
                </span>
              </div>
            </div>
            {currentEntry.reminder && (
              <div className="view-row">
                <div className="view-label" style={{ color: colors.grey }}>Reminder</div>
                <div className="view-value" style={{ color: colors.black }}>
                  {new Date(currentEntry.reminder).toLocaleString()}
                </div>
              </div>
            )}
          </div>

          {currentEntry.address && (
            <div className="view-section">
              <h3 style={{ color: colors.black }}>Location</h3>
              <div className="address-card" style={{ 
                backgroundColor: colors.secondary,
                padding: '16px',
                borderRadius: '12px',
                marginTop: '8px'
              }}>
                <div style={{ color: colors.black, lineHeight: '1.5' }}>
                  {currentEntry.address}
                </div>
                {currentEntry.latitude && currentEntry.longitude && (
                  <div style={{ 
                    color: colors.grey, 
                    fontSize: '12px',
                    marginTop: '8px'
                  }}>
                    Coordinates: {currentEntry.latitude.toFixed(6)}, {currentEntry.longitude.toFixed(6)}
                    <div>
                      Address :{currentEntry.address}
                      </div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="view-section">
            <div className="section-header">
              <h3 style={{ color: colors.black }}>Contacts</h3>
              <span className="contact-count" style={{ color: colors.primary }}>
                {currentEntry.contacts.length}
              </span>
            </div>
            {currentEntry.contacts.map((contact, index) => (
              <div key={index} className="mobile-contact-view" style={{ borderColor: colors.mediumgrey }}>
                <h4 style={{ color: colors.black }}>Contact {index + 1}</h4>
                <div className="contact-details">
                  {contact.contactName && (
                    <div className="view-row">
                      <div className="view-label" style={{ color: colors.grey }}>Name</div>
                      <div className="view-value" style={{ color: colors.black }}>{contact.contactName}</div>
                    </div>
                  )}
                  {contact.phone && (
                    <div className="view-row">
                      <div className="view-label" style={{ color: colors.grey }}>Phone</div>
                      <div className="view-value" style={{ color: colors.black }}>{contact.phone}</div>
                    </div>
                  )}
                  {contact.email && (
                    <div className="view-row">
                      <div className="view-label" style={{ color: colors.grey }}>Email</div>
                      <div className="view-value" style={{ color: colors.black }}>{contact.email}</div>
                    </div>
                  )}
                  {contact.notes && (
                    <div className="view-row">
                      <div className="view-label" style={{ color: colors.grey }}>Notes</div>
                      <div className="view-value" style={{ color: colors.black }}>{contact.notes}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {currentEntry.notes && (
            <div className="view-section">
              <h3 style={{ color: colors.black }}>General Notes</h3>
              <div className="notes-content" style={{ 
                color: colors.black,
                backgroundColor: colors.secondary,
                padding: '16px',
                borderRadius: '12px',
                lineHeight: '1.5'
              }}>
                {currentEntry.notes}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );

  // Render entries list
  const renderList = () => (
    <div className="mobile-list-container">
      <div className="mobile-header" style={{ backgroundColor: colors.primary }}>
        <AppLogo />
        <button 
          className="mobile-add-btn" 
          onClick={() => {
            setCurrentEntry({
              id: null,
              date: new Date().toISOString().split('T')[0],
              companyName: '',
              contacts: [{ phone: '', email: '', contactName: '', notes: '' }],
              address: '',
              latitude: '',
              longitude: '',
              reminder: '',
              status: 'pending',
              notes: ''
            });
            setEditingId(null);
            setViewMode('form');
          }}
          style={{ color: colors.white }}
        >
          +
        </button>
      </div>

      {loading ? (
        <div className="loading-container">
          <div className="loading-spinner" style={{ borderColor: colors.primary }}></div>
          <p style={{ color: colors.grey }}>Loading visits...</p>
        </div>
      ) : (
        <>
          {/* Status Tabs */}
          {renderStatusTabs()}

          {/* Stats Cards */}
          {/* <div className="mobile-stats">
            <div className="mobile-stat-card" style={{ backgroundColor: colors.secondary }}>
              <div className="stat-number" style={{ color: colors.primary }}>{statusCounts.all}</div>
              <div className="stat-label" style={{ color: colors.black }}>Total Visits</div>
            </div>
            <div className="mobile-stat-card" style={{ backgroundColor: colors.secondary }}>
              <div className="stat-number" style={{ color: colors.primary }}>
                {statusCounts.completed}
              </div>
              <div className="stat-label" style={{ color: colors.black }}>Completed</div>
            </div>
            <div className="mobile-stat-card" style={{ backgroundColor: colors.secondary }}>
              <div className="stat-number" style={{ color: colors.primary }}>
                {statusCounts.pending}
              </div>
              <div className="stat-label" style={{ color: colors.black }}>Pending</div>
            </div>
            <div className="mobile-stat-card" style={{ backgroundColor: colors.secondary }}>
              <div className="stat-number" style={{ color: colors.primary }}>
                {statusCounts.followup}
              </div>
              <div className="stat-label" style={{ color: colors.black }}>Follow-up</div>
            </div>
          </div> */}

          {filteredEntries.length === 0 ? (
            <div className="mobile-empty-state">
              <div className="empty-icon" style={{ color: colors.mediumgrey }}>📋</div>
              <p style={{ color: colors.grey }}>
                {activeTab === 'all' 
                  ? 'No visits recorded yet' 
                  : `No ${activeTab} visits found`
                }
              </p>
              {activeTab !== 'all' && (
                <button 
                  className="mobile-empty-btn"
                  onClick={() => setActiveTab('all')}
                  style={{
                    backgroundColor: colors.mediumgrey,
                    color: colors.black,
                    marginBottom: '10px'
                  }}
                >
                  Show All Visits
                </button>
              )}
              <button 
                className="mobile-empty-btn"
                onClick={() => setViewMode('form')}
                style={{
                  backgroundColor: colors.primary,
                  color: colors.white
                }}
              >
                Add New Visit
              </button>
            </div>
          ) : (
            <div className="mobile-entries-list">
              {filteredEntries.map(entry => (
                <div key={entry.id} className="mobile-entry-card" style={{ borderColor: colors.mediumgrey }}>
                  <div className="entry-header">
                    <div className="entry-company" style={{ color: colors.black }}>
                      {entry.companyName}
                    </div>
                    <span 
                      className="mobile-entry-status"
                      style={{ 
                        backgroundColor: getStatusColor(entry.status) + '20',
                        color: getStatusColor(entry.status)
                      }}
                    >
                      {entry.status}
                    </span>
                  </div>
                  <div className="entry-details">
                    <div className="entry-date" style={{ color: colors.grey }}>
                      📅 {entry.visitDate}
                    </div>
                    {entry.address && (
                      <div className="entry-address" style={{ color: colors.grey, fontSize: '13px', marginTop: '4px' }}>
                        📍 {entry.address.length > 40 ? entry.address.substring(0, 40) + '...' : entry.address}
                      </div>
                    )}
                    <div className="entry-contacts" style={{ color: colors.grey, marginTop: '4px' }}>
                      👥 {entry.contacts.length} contact(s)
                    </div>
                  </div>
                  <div className="entry-actions">
                    <button 
                      className="mobile-action-btn"
                      onClick={() => handleView(entry)}
                      style={{ color: colors.primary }}
                    >
                      View
                    </button>
                    <button 
                      className="mobile-action-btn"
                      onClick={() => handleEdit(entry)}
                      style={{ color: colors.primary }}
                    >
                      Edit
                    </button>
                    <button 
                      className="mobile-action-btn delete"
                      onClick={() => handleDelete(entry.id)}
                      style={{ color: '#FF6B6B' }}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <div className="mobile-app-container" style={{ backgroundColor: colors.lightgrey }}>
      {/* Toast Notification */}
      {showToast && (
        <div 
          className="mobile-toast"
          style={{
            backgroundColor: colors.primary,
            color: colors.white
          }}
        >
          {toastMessage}
        </div>
      )}

      {/* Main Content */}
      <div className="mobile-main-content">
        {viewMode === 'list' && renderList()}
        {viewMode === 'form' && renderForm()}
        {viewMode === 'view' && renderView()}
      </div>
    </div>
  );
};

// Updated CSS Styles with Tabs
const styles = `
/* Mobile App Container */
.mobile-app-container {
  min-height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow-x: hidden;
}

/* Main Content */
.mobile-main-content {
  max-width: 100%;
  margin: 0 auto;
  position: relative;
}

/* Mobile Header */
.mobile-header {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  padding-top:20px;
  z-index: 1000;
  box-shadow: 0 2px 10px rgba(0,0,0,0.1);
}

.app-logo {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-left: 40px;
}

.logo-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: bold;
  font-size: 18px;
}

.logo-text {
  font-weight: 600;
  font-size: 16px;
}

.mobile-back-btn,
.mobile-add-btn,
.mobile-edit-btn {
  background: none;
  border: none;
  font-size: 24px;
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  padding: 0;
}

.header-title {
  font-weight: 600;
  font-size: 18px;
  position: absolute;
  left: 30%;
  transform: translateX(-50%);
}

/* Status Tabs */
.status-tabs-container {
  padding: 70px 16px 0;
  overflow-x: auto;
  white-space: nowrap;
  -webkit-overflow-scrolling: touch;
}

.status-tabs {
  display: flex;
  gap: 8px;
  padding-bottom: 8px;
}

.status-tab {
  flex: 1;
  min-width: 80px;
  border: 1px solid;
  border-radius: 12px;
  padding: 12px 8px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.status-tab.active {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
}

.tab-count {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 4px;
}

.tab-label {
  font-size: 12px;
  font-weight: 500;
}

/* Toast */
.mobile-toast {
  position: fixed;
  top: 80px;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 25px;
  font-size: 14px;
  z-index: 1001;
  animation: slideDown 0.3s ease-out;
  box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  text-align: center;
  max-width: 80%;
}

@keyframes slideDown {
  from {
    transform: translate(-50%, -20px);
    opacity: 0;
  }
  to {
    transform: translate(-50%, 0);
    opacity: 1;
  }
}

/* Form Container */
.mobile-form-container {
  padding-top: 60px;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.form-container {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.mobile-form-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: 80px; /* Space for fixed button */
}

/* Form Elements */
.form-group {
  margin-bottom: 20px;
}

.form-group label {
  display: block;
  margin-bottom: 8px;
  font-weight: 500;
  font-size: 14px;
}

.form-input {
  width: 100%;
  padding: 14px 16px;
  border-radius: 12px;
  font-size: 16px;
  border: 1px solid;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

.form-input:focus {
  outline: none;
}

/* Buttons */
.mobile-location-btn,
.mobile-add-btn,
.mobile-remove-btn,
.mobile-submit-btn,
.mobile-empty-btn {
  width: 100%;
  padding: 16px;
  border-radius: 12px;
  border: none;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  text-align: center;
  transition: opacity 0.2s;
}

.mobile-location-btn {
  margin-bottom: 10px;
}

.mobile-add-btn {
  width: auto;
  padding: 8px 16px;
  border-radius: 20px;
}

.mobile-remove-btn {
  width: auto;
  background: none;
  font-size: 14px;
  padding: 4px 12px;
}

.mobile-submit-btn {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  border-radius: 0;
  height: 60px;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
}

/* Contacts Section */
.contacts-section {
  margin: 24px 0;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.section-header h3 {
  margin: 0;
  font-size: 18px;
}

.contact-card {
  padding: 16px;
  border-radius: 12px;
  margin-bottom: 16px;
  border: 1px solid;
}

.contact-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.contact-header h4 {
  margin: 0;
  font-size: 16px;
}

.contact-fields {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* List View */
.mobile-list-container {
  padding-top: 20px;
  min-height: 100vh;
}

.loading-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 100px 20px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid;
  border-radius: 50%;
  border-top-color: transparent;
  animation: spin 1s linear infinite;
  margin-bottom: 16px;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

.mobile-stats {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  padding: 16px;
  padding-top: 8px;
}

.mobile-stat-card {
  padding: 16px;
  border-radius: 12px;
  text-align: center;
}

.stat-number {
  font-size: 20px;
  font-weight: bold;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  opacity: 0.8;
}

/* Entry Cards */
.mobile-entries-list {
  padding: 0 16px 16px;
}

.mobile-entry-card {
  background: white;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05);
}

.entry-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 12px;
}

.entry-company {
  font-size: 16px;
  font-weight: 600;
  flex: 1;
  margin-right: 8px;
}

.mobile-entry-status {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
  white-space: nowrap;
}

.entry-details {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 16px;
  font-size: 14px;
}

.entry-address {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
}

.entry-actions {
  display: flex;
  gap: 12px;
  padding-top: 12px;
  border-top: 1px solid #E5E5E5;
}

.mobile-action-btn {
  flex: 1;
  padding: 8px;
  background: none;
  border: none;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border-radius: 8px;
  transition: background-color 0.2s;
}

.mobile-action-btn:hover {
  background-color: rgba(0,0,0,0.05);
}

.mobile-action-btn.delete:hover {
  background-color: rgba(255,107,107,0.1);
}

/* Empty State */
.mobile-empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60px 20px;
  text-align: center;
}

.empty-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.mobile-empty-btn {
  margin-top: 10px;
  max-width: 200px;
  width: 100%;
  padding: 12px;
  border-radius: 12px;
  border: none;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

/* View Container */
.mobile-view-container {
  padding-top: 60px;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.mobile-view-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.view-card {
  background: white;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
}

.view-section {
  margin-bottom: 24px;
}

.view-section h3 {
  margin: 0 0 16px 0;
  font-size: 18px;
}

.view-row {
  display: flex;
  justify-content: space-between;
  margin-bottom: 12px;
}

.view-label {
  font-size: 14px;
  flex: 1;
}

.view-value {
  font-size: 14px;
  flex: 2;
  text-align: right;
}

.mobile-status-badge {
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
  text-transform: uppercase;
}

.mobile-contact-view {
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 12px;
  border: 1px solid;
}

.mobile-contact-view h4 {
  margin: 0 0 12px 0;
  font-size: 14px;
}

.contact-details {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notes-content {
  font-size: 14px;
  line-height: 1.5;
  white-space: pre-wrap;
}

.contact-count {
  font-weight: 600;
  font-size: 16px;
}

/* Address Display */
.address-display {
  word-break: break-word;
}

/* Responsive Adjustments */
@media (min-width: 768px) {
  .mobile-app-container {
    max-width: 768px;
    margin: 0 auto;
    box-shadow: 0 0 20px rgba(0,0,0,0.1);
  }
  
  .mobile-header {
    border-radius: 0;
  }
  
  .status-tabs {
    justify-content: center;
  }
  
  .status-tab {
    min-width: 100px;
  }
  
  .mobile-stats {
    grid-template-columns: repeat(4, 1fr);
  }
  
  .contact-fields {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 12px;
  }
}

/* Hide scrollbar but keep functionality */
.mobile-form-scroll::-webkit-scrollbar,
.mobile-view-scroll::-webkit-scrollbar,
.status-tabs-container::-webkit-scrollbar {
  display: none;
}

.mobile-form-scroll,
.mobile-view-scroll,
.status-tabs-container {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

/* Scrollable tabs on mobile */
.status-tabs-container {
  scrollbar-width: none;
}

.status-tabs-container::-webkit-scrollbar {
  display: none;
}
`;

// Create style element
const styleSheet = document.createElement("style");
styleSheet.type = "text/css";
styleSheet.innerText = styles;
document.head.appendChild(styleSheet);

export default MarketingTrackerApp;
