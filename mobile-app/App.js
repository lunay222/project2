/**
 * AI Context-Aware Study Coach - Mobile App
 * Main React Native application component
 * 
 * Features:
 * - Camera input for scanning notes (hardware input)
 * - Quiz display with multiple question types (hardware output - display)
 * - TTS for reading questions (hardware output - audio)
 * - Vibration alerts for spaced repetition (hardware output - haptic)
 */

import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Vibration,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Speech from 'expo-speech';
import StudyCoachAPI from './services/api';
import { getBackendURL, detectBackendIP } from './utils/ipDetector';
// Default fallback IP - will be auto-detected on startup
const DEFAULT_API_URL = 'http://192.168.1.100:8000';


export default function App() {
  const [mode, setMode] = useState('home'); // 'home', 'results', 'settings', 'scanning'
  const [resultsView, setResultsView] = useState('summary'); // 'summary', 'flashcards', 'quiz' - which section to show in results
  const [extractedText, setExtractedText] = useState('');
  const [scannedTexts, setScannedTexts] = useState([]); // Array of scanned text from multiple documents
  const [isScanning, setIsScanning] = useState(false); // Track if we're in multi-scan mode
  const [quizData, setQuizData] = useState(null);
  const [summary, setSummary] = useState('');
  const [flashcards, setFlashcards] = useState([]);
  const [loading, setLoading] = useState(false);
  const [revealedAnswers, setRevealedAnswers] = useState({}); // Track which answers are revealed
  const [selectedOptions, setSelectedOptions] = useState({}); // Track selected multiple choice answers
  const [apiUrl, setApiUrl] = useState(null); // Start as null - will be set after detection
  const [isDetectingIP, setIsDetectingIP] = useState(true); // Track if IP detection is in progress
  const [tempUrl, setTempUrl] = useState(DEFAULT_API_URL); // Temporary URL for settings input
  const [showInstructions, setShowInstructions] = useState(false); // Show/hide IP instructions

  // Initialize API URL and request permissions on mount
  useEffect(() => {
    // Auto-detect backend IP on startup - wait for it to complete before allowing API calls
    const initializeBackend = async () => {
      setIsDetectingIP(true);
      try {
        console.log('🔍 Auto-detecting backend IP address...');
        const detectedURL = await getBackendURL();
        console.log('✅ Backend URL set to:', detectedURL);
        setApiUrl(detectedURL);
        StudyCoachAPI.setBaseURL(detectedURL);
      } catch (error) {
        console.warn('⚠️ Auto-detection failed, using fallback:', error);
        // Use fallback if detection fails
        setApiUrl(DEFAULT_API_URL);
        StudyCoachAPI.setBaseURL(DEFAULT_API_URL);
      } finally {
        setIsDetectingIP(false);
      }
    };

    initializeBackend();
    requestPermissions();
  }, []); // Only run once on mount

  // Update API service when apiUrl changes (but only if apiUrl is not null)
  useEffect(() => {
    if (apiUrl) {
      StudyCoachAPI.setBaseURL(apiUrl);
    }
  }, [apiUrl]);

  // Update tempUrl when entering settings mode
  useEffect(() => {
    if (mode === 'settings') {
      setTempUrl(apiUrl);
    }
  }, [mode, apiUrl]);

  const requestPermissions = async () => {
    try {
      const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
      if (cameraStatus !== 'granted') {
        console.log('Camera permission not granted');
      }
    } catch (error) {
      console.error('Error requesting permissions:', error);
    }
  };

  /**
   * Handle scanning notes from camera
   * This is the hardware input - phone camera
   * Now supports multiple document scanning
   */
  const handleScanNotes = async () => {
    // Wait for IP detection to complete before allowing API calls
    if (isDetectingIP || !apiUrl) {
      Alert.alert(
        'Please wait',
        'Detecting backend server... Please wait a moment and try again.'
      );
      return;
    }
    
    try {
      setLoading(true);
      
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to scan notes');
        setLoading(false);
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images', // String value works across all expo-image-picker versions
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        
        // Upload image to backend
        const formData = new FormData();
        formData.append('file', {
          uri: imageUri,
          type: 'image/jpeg',
          name: 'notes.jpg',
        });

        // Step 1: Scan image (OCR)
        const scanResponse = await StudyCoachAPI.scanNotes(formData);
        
        if (scanResponse && scanResponse.success) {
          const newText = scanResponse.text;
          
          // Add to scanned texts array and update state
          setScannedTexts(prev => {
            const updated = [...prev, newText];
            setExtractedText(newText); // Keep latest for display
            // Enter scanning mode after state update
            setIsScanning(true);
            setMode('scanning');
            
            // No alert - user can use buttons on scanning screen
            // Just show a brief success indicator via vibration
            Vibration.vibrate(100);
            
            return updated;
          });
        } else {
          Alert.alert('Error', 'Failed to extract text from image');
        }
      }
    } catch (error) {
      console.error('Error scanning notes:', error);
      Alert.alert('Error', 'Failed to scan notes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Continue scanning another document
   */
  const handleContinueScanning = async () => {
    try {
      setLoading(true);
      
      // Request camera permission
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Camera permission is required to scan notes');
        setLoading(false);
        return;
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: 'images',
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets[0]) {
        const imageUri = result.assets[0].uri;
        
        // Upload image to backend
        const formData = new FormData();
        formData.append('file', {
          uri: imageUri,
          type: 'image/jpeg',
          name: 'notes.jpg',
        });

        // Scan image (OCR)
        const scanResponse = await StudyCoachAPI.scanNotes(formData);
        
        if (scanResponse && scanResponse.success) {
          const newText = scanResponse.text;
          
          // Add to scanned texts array and update state
          setScannedTexts(prev => {
            const updated = [...prev, newText];
            setExtractedText(newText); // Keep latest for display
            
            // No alert - user can use buttons on scanning screen
            // Just show a brief success indicator via vibration
            Vibration.vibrate(100);
            
            return updated;
          });
          
          // Ensure we're in scanning mode
          setIsScanning(true);
          setMode('scanning');
        } else {
          Alert.alert('Error', 'Failed to extract text from image');
        }
      }
    } catch (error) {
      console.error('Error scanning notes:', error);
      Alert.alert('Error', 'Failed to scan notes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Finish scanning and generate content from all scanned documents
   */
  const handleFinishScanning = async () => {
    try {
      if (scannedTexts.length === 0) {
        Alert.alert('No Documents', 'Please scan at least one document first');
        return;
      }

      // Combine all scanned text
      const combinedText = scannedTexts.join('\n\n--- Document Break ---\n\n');
      
      // Warn if text is very long (might cause timeouts)
      if (combinedText.length > 10000) {
        Alert.alert(
          '⚠️ Large Text Warning',
          `Your combined text is ${combinedText.length} characters long. This may take 3-5 minutes to process. Continue?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Continue',
              onPress: async () => {
                setExtractedText(combinedText);
                setIsScanning(false);
                // Small delay to ensure backend is ready
                await new Promise(resolve => setTimeout(resolve, 500));
                await generateStudyContent(combinedText);
              }
            }
          ]
        );
        return;
      }
      
      setExtractedText(combinedText);
      
      // Reset scanning state
      setIsScanning(false);
      
      // Small delay to ensure backend/Ollama is ready after scanning
      // This helps avoid connection issues when generating immediately after scanning
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Generate content from all scanned documents
      await generateStudyContent(combinedText);
    } catch (error) {
      console.error('Error finishing scan:', error);
      Alert.alert(
        'Error',
        `Failed to generate content: ${error.message}\n\nIf this persists, try:\n1. Waiting a few seconds and trying again\n2. Scanning fewer documents\n3. Checking backend connection\n4. Restarting the backend`
      );
    }
  };

  /**
   * Cancel scanning and clear scanned documents
   */
  const handleCancelScanning = () => {
    Alert.alert(
      'Cancel Scanning?',
      'This will clear all scanned documents. Are you sure?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes',
          style: 'destructive',
          onPress: () => {
            setScannedTexts([]);
            setIsScanning(false);
            setExtractedText('');
            setMode('home');
          }
        }
      ]
    );
  };

  /**
   * Generate all study content (quiz, summary, flashcards)
   * Shows results progressively as they become available
   */
  const generateStudyContent = async (text) => {
    try {
      setLoading(true);
      setMode('results');
      
      // Reset state
      setQuizData(null);
      setSummary('');
      setFlashcards([]);
      setRevealedAnswers({});
      setSelectedOptions({});
      setScannedTexts([]); // Clear scanned documents
      setIsScanning(false); // Exit scanning mode
      setResultsView('summary'); // Start with summary view
      
      // Show initial status - this helps users know something is happening
      Alert.alert(
        '⏳ Generating Content',
        'This may take 5-10 minutes. The AI is creating quizzes, summaries, and flashcards from your notes...',
        [{ text: 'OK' }]
      );
      
      // Wait for IP detection to complete before allowing API calls
      if (isDetectingIP || !apiUrl) {
        Alert.alert(
          'Please wait',
          'Detecting backend server... Please wait a moment and try again.'
        );
        setLoading(false);
        return;
      }
      
      // Generate in parallel with staggered starts to avoid overwhelming Ollama
      // Start requests 3 seconds apart so they don't all hit at once
      // This is faster than sequential but more reliable than all-at-once
      const isLongText = text.length > 5000;
      const estimatedTime = isLongText ? '3-5 minutes' : '2-4 minutes';
      
      console.log(`Generating content in parallel (staggered start) - text length: ${text.length} chars...`);
      
      // Start summary first (usually fastest)
      const summaryPromise = StudyCoachAPI.generateSummary(text)
        .then(result => {
          if (result.success && result.summary) {
            setSummary(result.summary);
            Vibration.vibrate(50);
            console.log('✅ Summary generated successfully');
          }
          return result;
        })
        .catch(e => {
          console.error('Summary generation failed:', e);
          return { success: false, error: e.message };
        });
      
      // Start flashcards 3 seconds later
      await new Promise(resolve => setTimeout(resolve, 3000));
      const flashcardsPromise = StudyCoachAPI.generateFlashcards(text)
        .then(result => {
          if (result.success && result.flashcards) {
            setFlashcards(result.flashcards);
            Vibration.vibrate(50);
            console.log('✅ Flashcards generated successfully');
          }
          return result;
        })
        .catch(e => {
          console.error('Flashcards generation failed:', e);
          return { success: false, error: e.message };
        });
      
      // Start quiz 3 seconds after flashcards (6 seconds after summary)
      await new Promise(resolve => setTimeout(resolve, 3000));
      const quizPromise = StudyCoachAPI.generateQuiz(text, 'multiple_choice')
        .then(result => {
          if (result.success && result.quiz) {
            setQuizData(result.quiz);
            Vibration.vibrate(100);
            console.log('✅ Quiz generated successfully');
          } else {
            console.warn('Quiz generation returned no data:', result);
          }
          return result;
        })
        .catch(e => {
          console.error('Quiz generation failed:', e);
          Alert.alert('⚠️ Quiz Error', `Quiz generation failed: ${e.message}\n\nSummary and flashcards may still be available.`);
          return { success: false, error: e.message };
        });
      
      // Wait for all to complete (they're running in parallel but started at different times)
      await Promise.all([summaryPromise, flashcardsPromise, quizPromise]);
      
      Vibration.vibrate(200);
      
    } catch (error) {
      console.error('Error generating content:', error);
      Alert.alert('Error', 'Failed to generate content: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Text-to-Speech function
   * This is hardware output - audio playback
   */
  const handleTextToSpeech = async (text) => {
    try {
      // Use Expo Speech for TTS
      Speech.speak(text, {
        language: 'en',
        pitch: 1.0,
        rate: 0.9,
      });
    } catch (error) {
      console.error('Error with TTS:', error);
      Alert.alert('Error', 'Failed to convert text to speech');
    }
  };

  /**
   * Toggle answer reveal for a question
   */
  const toggleAnswer = (questionId) => {
    setRevealedAnswers(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
    
    // Trigger vibration on reveal
    Vibration.vibrate(50);
  };

  /**
   * Handle multiple choice option selection
   * Now shows immediate feedback if answer is correct or incorrect
   */
  const handleOptionSelect = (questionId, optionIndex, correctAnswerIndex) => {
    setSelectedOptions(prev => ({
      ...prev,
      [questionId]: optionIndex
    }));
    
    // Immediately show if the answer is correct or incorrect
    const isCorrect = optionIndex === correctAnswerIndex;
    
    // Trigger different vibration patterns for correct vs incorrect
    if (isCorrect) {
      Vibration.vibrate([100, 50, 100]); // Success pattern
    } else {
      Vibration.vibrate(200); // Error pattern
    }
  };

  /**
   * Handle saving API URL from settings
   */
  const handleSaveApiUrl = (url) => {
    if (url && url.trim()) {
      const trimmedUrl = url.trim();
      // Validate URL format
      if (trimmedUrl.startsWith('http://') || trimmedUrl.startsWith('https://')) {
        setApiUrl(trimmedUrl);
        StudyCoachAPI.setBaseURL(trimmedUrl);
        Alert.alert('Success', 'API URL updated successfully!');
        setMode('home');
      } else {
        Alert.alert('Invalid URL', 'URL must start with http:// or https://');
      }
    } else {
      Alert.alert('Error', 'Please enter a valid URL');
    }
  };

  /**
   * Test API connection
   */
  const testApiConnection = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${apiUrl}/health`);
      if (response.ok) {
        const data = await response.json();
        Alert.alert('✅ Connection Successful', `Backend is healthy!\n\nStatus: ${data.status}\n\nYou can now use the app!`);
      } else {
        Alert.alert('❌ Connection Failed', `Backend returned status: ${response.status}`);
      }
    } catch (error) {
      Alert.alert('❌ Connection Failed', `Cannot connect to backend.\n\nMake sure:\n1. Backend is running (docker-compose up -d)\n2. IP address is correct\n3. Phone and computer are on same WiFi\n4. Firewall allows port 8000`);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Auto-detect backend using IP detection utility
   */
  const autoDetectBackend = async () => {
    setIsDetectingIP(true);
    setLoading(true);
    
    Alert.alert(
      '🔍 Auto-Detecting Backend',
      'Scanning network for backend...\nThis may take 30-60 seconds.',
      [{ text: 'OK' }]
    );

    try {
      const detectedIP = await detectBackendIP();
      
      if (detectedIP) {
        const detectedUrl = `http://${detectedIP}:8000`;
        setApiUrl(detectedUrl);
        StudyCoachAPI.setBaseURL(detectedUrl);
        setIsDetectingIP(false);
        setLoading(false);
        Alert.alert(
          '🎉 Backend Found!',
          `Automatically detected backend at:\n${detectedUrl}\n\nURL has been saved!`,
          [{ text: 'Great!', onPress: () => setMode('home') }]
        );
      } else {
        setIsDetectingIP(false);
        setLoading(false);
        Alert.alert(
          '❌ Backend Not Found',
          'Could not automatically detect your backend.\n\nPlease:\n1. Make sure backend is running\n2. Enter your IP manually\n3. Check that phone and computer are on same WiFi',
          [{ text: 'OK' }]
        );
      }
    } catch (error) {
      setIsDetectingIP(false);
      setLoading(false);
      Alert.alert(
        '❌ Detection Error',
        `Error during auto-detection: ${error.message}\n\nPlease enter your IP manually.`,
        [{ text: 'OK' }]
      );
    }
  };

  /**
   * Render settings screen
   */
  const renderSettings = () => {
    return (
      <ScrollView style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => setMode('home')}
        >
          <Text style={styles.backButtonText}>← Back to Home</Text>
        </TouchableOpacity>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⚙️ Backend Settings</Text>
          
          <View style={styles.settingsCard}>
            <Text style={styles.settingsLabel}>Connect to Backend</Text>
            <Text style={styles.settingsHint}>
              The app needs to connect to your computer where the backend is running.
            </Text>
            
            {/* Auto-detect button - most user-friendly */}
            <TouchableOpacity
              style={[styles.button, styles.autoDetectButton]}
              onPress={autoDetectBackend}
              disabled={loading}
            >
              <Text style={styles.buttonText}>
                {loading ? '🔍 Searching...' : '✨ Auto-Detect Backend'}
              </Text>
            </TouchableOpacity>
            
            <Text style={styles.orText}>OR</Text>
            
            {/* Manual entry */}
            <Text style={styles.settingsSubLabel}>Enter Backend URL Manually</Text>
            <TextInput
              style={styles.textInput}
              value={tempUrl}
              onChangeText={setTempUrl}
              placeholder="http://192.168.1.100:8000"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />
            
            <TouchableOpacity
              style={styles.helpButton}
              onPress={() => setShowInstructions(!showInstructions)}
            >
              <Text style={styles.helpButtonText}>
                {showInstructions ? '▼' : '▶'} How do I find my IP address?
              </Text>
            </TouchableOpacity>
            
            {showInstructions && (
              <View style={styles.instructionsBox}>
                <Text style={styles.instructionsTitle}>📋 Finding Your IP Address:</Text>
                <Text style={styles.instructionsText}>
                  <Text style={styles.instructionsBold}>On Mac:</Text>{'\n'}
                  1. Open Terminal{'\n'}
                  2. Type: ifconfig{'\n'}
                  3. Look for "inet 192.168.x.x" (not 127.0.0.1){'\n\n'}
                  
                  <Text style={styles.instructionsBold}>On Windows:</Text>{'\n'}
                  1. Open Command Prompt{'\n'}
                  2. Type: ipconfig{'\n'}
                  3. Look for "IPv4 Address" under WiFi adapter{'\n\n'}
                  
                  <Text style={styles.instructionsBold}>On Linux:</Text>{'\n'}
                  1. Open Terminal{'\n'}
                  2. Type: ip addr show{'\n'}
                  3. Look for "inet 192.168.x.x"{'\n\n'}
                  
                  Then enter: http://YOUR_IP:8000
                </Text>
              </View>
            )}
            
            <View style={styles.buttonRow}>
              <TouchableOpacity
                style={[styles.button, styles.testButton]}
                onPress={testApiConnection}
                disabled={loading}
              >
                <Text style={styles.buttonText}>🔍 Test</Text>
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.button, styles.saveButton]}
                onPress={() => handleSaveApiUrl(tempUrl)}
              >
                <Text style={styles.buttonText}>💾 Save</Text>
              </TouchableOpacity>
            </View>
            
            <View style={styles.currentUrlBox}>
              <Text style={styles.currentUrlLabel}>Current Backend:</Text>
              <Text style={styles.currentUrlText}>{apiUrl}</Text>
            </View>
          </View>
        </View>
      </ScrollView>
    );
  };

  /**
   * Render scanning mode screen (when scanning multiple documents)
   */
  const renderScanning = () => (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={handleCancelScanning}
      >
        <Text style={styles.backButtonText}>← Cancel</Text>
      </TouchableOpacity>

      <ScrollView 
        style={styles.scanningContainer}
        contentContainerStyle={styles.scanningContent}
      >
        <Text style={styles.title}>📷 Scanning Mode</Text>
        <Text style={styles.subtitle}>
          {scannedTexts.length} document{scannedTexts.length !== 1 ? 's' : ''} scanned
        </Text>

        <View style={styles.scanningStatus}>
          <Text style={styles.scanningStatusText}>
            {scannedTexts.length > 0 
              ? `✅ ${scannedTexts.length} document${scannedTexts.length !== 1 ? 's' : ''} ready`
              : 'No documents scanned yet'}
          </Text>
        </View>

        <View style={styles.scanningButtons}>
          <TouchableOpacity
            style={[styles.button, styles.continueButton]}
            onPress={handleContinueScanning}
            disabled={loading}
          >
            <Text style={styles.buttonText}>📷 Scan Another Document</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, styles.finishButton, styles.doneButton]}
            onPress={handleFinishScanning}
            disabled={loading || scannedTexts.length === 0}
          >
            <Text style={styles.buttonText}>
              ✅ Done Scanning - Generate Content
            </Text>
            <Text style={styles.buttonSubtext}>
              ({scannedTexts.length} document{scannedTexts.length !== 1 ? 's' : ''} ready)
            </Text>
          </TouchableOpacity>
        </View>

        {loading && <ActivityIndicator size="large" style={styles.loader} />}

        {/* Show preview of latest scanned text */}
        {extractedText && (
          <View style={styles.previewBox}>
            <Text style={styles.previewTitle}>Latest Document Preview:</Text>
            <Text style={styles.previewText} numberOfLines={5}>
              {extractedText.substring(0, 200)}...
            </Text>
          </View>
        )}
      </ScrollView>
    </View>
  );

  /**
   * Render home screen
   */
  const renderHome = () => (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={() => setMode('settings')}
      >
        <Text style={styles.settingsButtonText}>⚙️</Text>
      </TouchableOpacity>
      
      <Text style={styles.title}>AI Study Coach</Text>
      <Text style={styles.subtitle}>Scan your notes to generate quizzes</Text>
      
      {/* Show detection status */}
      {isDetectingIP ? (
        <View style={styles.detectionBox}>
          <ActivityIndicator size="large" color="#4CAF50" />
          <Text style={styles.detectionText}>🔍 Detecting backend server...</Text>
          <Text style={styles.detectionSubtext}>Please wait, this may take a minute</Text>
        </View>
      ) : (
        <>
          {apiUrl ? (
            <>
              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleScanNotes}
                disabled={loading}
              >
                <Text style={styles.buttonText}>📷 Scan Notes</Text>
              </TouchableOpacity>
              
              {loading && <ActivityIndicator size="large" style={styles.loader} />}
              <Text style={styles.apiUrlHint}>Connected to: {apiUrl}</Text>
            </>
          ) : (
            <View style={styles.detectionBox}>
              <Text style={styles.detectionText}>⚠️ Backend Not Detected</Text>
              <Text style={styles.detectionSubtext}>
                Auto-detection failed. Please enter your computer's IP address manually in Settings.
              </Text>
              <TouchableOpacity
                style={styles.button}
                onPress={() => setMode('settings')}
              >
                <Text style={styles.buttonText}>⚙️ Open Settings to Enter IP</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}
    </View>
  );

  /**
   * Render quiz question card
   */
  const renderQuizQuestion = (question, index, type) => {
    const questionId = `${type}-${index}`;
    const isRevealed = revealedAnswers[questionId];

    if (type === 'multiple_choice') {
      return (
        <View key={index} style={styles.questionCard}>
          <Text style={styles.questionNumber}>Question {index + 1}</Text>
          <Text style={styles.question}>{question.question}</Text>
          
          {question.options && question.options.map((option, optIndex) => {
            const isSelected = selectedOptions[questionId] === optIndex;
            const isCorrect = optIndex === question.correct_answer;
            const isIncorrect = isSelected && !isCorrect; // Show as incorrect if selected but wrong
            const showCorrect = isSelected && isCorrect; // Show as correct if selected and right
            
            return (
              <TouchableOpacity
                key={optIndex}
                style={[
                  styles.optionButton,
                  isSelected && !isCorrect && styles.optionIncorrect, // Show incorrect immediately
                  isSelected && isCorrect && styles.optionCorrect, // Show correct immediately
                  !isSelected && isCorrect && isRevealed && styles.optionCorrect // Show correct answer when revealed
                ]}
                onPress={() => handleOptionSelect(questionId, optIndex, question.correct_answer)}
                disabled={isSelected} // Disable after selection to prevent changing answer
              >
                <Text style={styles.optionText}>{option}</Text>
                {showCorrect && <Text style={styles.correctBadge}>✓ Correct!</Text>}
                {isIncorrect && <Text style={styles.incorrectBadge}>✗ Incorrect</Text>}
              </TouchableOpacity>
            );
          })}
          
          <TouchableOpacity
            style={styles.revealButton}
            onPress={() => toggleAnswer(questionId)}
          >
            <Text style={styles.revealButtonText}>
              {isRevealed ? 'Hide Answer' : 'Reveal Answer'}
            </Text>
          </TouchableOpacity>
          
          {isRevealed && question.explanation && (
            <Text style={styles.explanation}>{question.explanation}</Text>
          )}
          
          <TouchableOpacity
            style={styles.ttsButton}
            onPress={() => handleTextToSpeech(question.question)}
          >
            <Text style={styles.ttsButtonText}>🔊 Read Question</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (type === 'fill_blank') {
      return (
        <View key={index} style={styles.questionCard}>
          <Text style={styles.questionNumber}>Fill in the Blank {index + 1}</Text>
          <Text style={styles.question}>{question.question}</Text>
          
          <TouchableOpacity
            style={styles.revealButton}
            onPress={() => toggleAnswer(questionId)}
          >
            <Text style={styles.revealButtonText}>
              {isRevealed ? 'Hide Answer' : 'Reveal Answer'}
            </Text>
          </TouchableOpacity>
          
          {isRevealed && (
            <View style={styles.answerBox}>
              <Text style={styles.answerLabel}>Answer:</Text>
              <Text style={styles.answer}>{question.answer}</Text>
              {question.hint && <Text style={styles.hint}>Hint: {question.hint}</Text>}
            </View>
          )}
          
          <TouchableOpacity
            style={styles.ttsButton}
            onPress={() => handleTextToSpeech(question.question)}
          >
            <Text style={styles.ttsButtonText}>🔊 Read Question</Text>
          </TouchableOpacity>
        </View>
      );
    } else if (type === 'short_answer') {
      return (
        <View key={index} style={styles.questionCard}>
          <Text style={styles.questionNumber}>Short Answer {index + 1}</Text>
          <Text style={styles.question}>{question.question}</Text>
          
          <TouchableOpacity
            style={styles.revealButton}
            onPress={() => toggleAnswer(questionId)}
          >
            <Text style={styles.revealButtonText}>
              {isRevealed ? 'Hide Answer' : 'Reveal Answer'}
            </Text>
          </TouchableOpacity>
          
          {isRevealed && (
            <View style={styles.answerBox}>
              <Text style={styles.answerLabel}>Expected Answer:</Text>
              <Text style={styles.answer}>{question.answer}</Text>
              {question.key_points && question.key_points.length > 0 && (
                <View style={styles.keyPointsBox}>
                  <Text style={styles.keyPointsLabel}>Key Points:</Text>
                  {question.key_points.map((point, ptIndex) => (
                    <Text key={ptIndex} style={styles.keyPoint}>• {point}</Text>
                  ))}
                </View>
              )}
            </View>
          )}
          
          <TouchableOpacity
            style={styles.ttsButton}
            onPress={() => handleTextToSpeech(question.question)}
          >
            <Text style={styles.ttsButtonText}>🔊 Read Question</Text>
          </TouchableOpacity>
        </View>
      );
    }
    return null;
  };

  /**
   * Render results screen with organized sections: Summary first, then tabs for Flashcards and Quiz
   */
  const renderResults = () => {
    // Get quiz questions for display
    let questions = null;
    if (quizData) {
      if (quizData.multiple_choice && Array.isArray(quizData.multiple_choice)) {
        questions = quizData.multiple_choice;
      } else if (Array.isArray(quizData)) {
        questions = quizData;
      } else if (quizData.questions && Array.isArray(quizData.questions)) {
        questions = quizData.questions;
      }
    }
    
    return (
      <View style={styles.container}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => {
            setMode('home');
            setResultsView('summary'); // Reset to summary view
            setQuizData(null);
            setSummary('');
            setFlashcards([]);
            setExtractedText('');
            setScannedTexts([]);
            setIsScanning(false);
            setRevealedAnswers({});
            setSelectedOptions({});
          }}
        >
          <Text style={styles.backButtonText}>← Back to Home</Text>
        </TouchableOpacity>

        {/* Navigation Tabs for Summary, Flashcards and Quiz */}
        {(summary || flashcards.length > 0 || questions) && (
          <View style={styles.tabContainer}>
            {summary && (
              <TouchableOpacity
                style={[styles.tab, resultsView === 'summary' && styles.tabActive]}
                onPress={() => setResultsView('summary')}
              >
                <Text style={[styles.tabText, resultsView === 'summary' && styles.tabTextActive]}>
                  📝 Summary
                </Text>
              </TouchableOpacity>
            )}
            
            {flashcards.length > 0 && (
              <TouchableOpacity
                style={[styles.tab, resultsView === 'flashcards' && styles.tabActive]}
                onPress={() => setResultsView('flashcards')}
              >
                <Text style={[styles.tabText, resultsView === 'flashcards' && styles.tabTextActive]}>
                  🎴 Flashcards ({flashcards.length})
                </Text>
              </TouchableOpacity>
            )}
            
            {questions && questions.length > 0 && (
              <TouchableOpacity
                style={[styles.tab, resultsView === 'quiz' && styles.tabActive]}
                onPress={() => setResultsView('quiz')}
              >
                <Text style={[styles.tabText, resultsView === 'quiz' && styles.tabTextActive]}>
                  📚 Quiz ({questions.length})
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}

        {/* Content Area - Shows selected view, all scrollable */}
        <ScrollView style={styles.resultsContent}>
          {/* Summary View */}
          {resultsView === 'summary' && summary && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📝 Summary</Text>
              <Text style={styles.sectionContent}>{summary}</Text>
              <TouchableOpacity
                style={styles.ttsButton}
                onPress={() => handleTextToSpeech(summary)}
              >
                <Text style={styles.ttsButtonText}>🔊 Read Summary</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Flashcards View */}
          {resultsView === 'flashcards' && flashcards.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>🎴 Flashcards</Text>
              {flashcards.map((card, index) => (
                <View key={index} style={styles.card}>
                  <Text style={styles.cardFront}>{card.front}</Text>
                  <Text style={styles.cardBack}>{card.back}</Text>
                  <TouchableOpacity
                    style={styles.ttsButton}
                    onPress={() => handleTextToSpeech(`${card.front}. ${card.back}`)}
                  >
                    <Text style={styles.ttsButtonText}>🔊 Read Card</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}

          {/* Quiz View */}
          {resultsView === 'quiz' && questions && questions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>📚 Multiple Choice Quiz</Text>
              <View style={styles.quizTypeSection}>
                {questions.map((q, index) => {
                  if (!q || !q.question) {
                    console.warn(`Question ${index} is missing required fields:`, q);
                    return null;
                  }
                  return renderQuizQuestion(q, index, 'multiple_choice');
                })}
              </View>
            </View>
          )}

          {/* Empty states */}
          {resultsView === 'summary' && !summary && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No summary available</Text>
            </View>
          )}

          {resultsView === 'flashcards' && flashcards.length === 0 && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No flashcards available</Text>
            </View>
          )}

          {resultsView === 'quiz' && (!questions || questions.length === 0) && (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>No quiz questions available</Text>
            </View>
          )}

          {loading && <ActivityIndicator size="large" style={styles.loader} />}
        </ScrollView>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {mode === 'home' && renderHome()}
      {mode === 'scanning' && renderScanning()}
      {mode === 'results' && renderResults()}
      {mode === 'settings' && renderSettings()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: 60,
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    textAlign: 'center',
    marginBottom: 40,
    color: '#666',
  },
  button: {
    backgroundColor: '#4CAF50',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  loader: {
    marginTop: 20,
  },
  backButton: {
    marginBottom: 20,
    padding: 10,
  },
  backButtonText: {
    fontSize: 18,
    color: '#4CAF50',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: 30,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  sectionContent: {
    fontSize: 16,
    lineHeight: 24,
    color: '#555',
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 10,
  },
  quizTypeSection: {
    marginBottom: 20,
  },
  quizTypeTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#4CAF50',
  },
  questionCard: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  questionNumber: {
    fontSize: 14,
    color: '#999',
    marginBottom: 5,
  },
  question: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  optionButton: {
    backgroundColor: '#f0f0f0',
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  optionSelected: {
    borderColor: '#2196F3',
    backgroundColor: '#E3F2FD',
  },
  optionCorrect: {
    borderColor: '#4CAF50',
    backgroundColor: '#E8F5E9',
  },
  optionIncorrect: {
    borderColor: '#F44336',
    backgroundColor: '#FFEBEE',
  },
  optionText: {
    fontSize: 16,
    color: '#333',
  },
  correctBadge: {
    color: '#4CAF50',
    fontWeight: 'bold',
    marginTop: 5,
    fontSize: 14,
  },
  incorrectBadge: {
    color: '#F44336',
    fontWeight: 'bold',
    marginTop: 5,
    fontSize: 14,
  },
  revealButton: {
    backgroundColor: '#2196F3',
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
  },
  revealButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  answerBox: {
    backgroundColor: '#F5F5F5',
    padding: 15,
    borderRadius: 8,
    marginTop: 10,
  },
  answerLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
  },
  answer: {
    fontSize: 16,
    color: '#333',
    lineHeight: 24,
  },
  hint: {
    fontSize: 14,
    color: '#999',
    fontStyle: 'italic',
    marginTop: 5,
  },
  explanation: {
    fontSize: 14,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 10,
    padding: 10,
    backgroundColor: '#F5F5F5',
    borderRadius: 5,
  },
  keyPointsBox: {
    marginTop: 10,
  },
  keyPointsLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 5,
  },
  keyPoint: {
    fontSize: 14,
    color: '#555',
    marginLeft: 10,
    marginBottom: 3,
  },
  card: {
    backgroundColor: 'white',
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardFront: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  cardBack: {
    fontSize: 16,
    color: '#666',
    lineHeight: 24,
  },
  ttsButton: {
    backgroundColor: '#FF9800',
    padding: 10,
    borderRadius: 5,
    alignItems: 'center',
    marginTop: 10,
  },
  ttsButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
  },
  settingsButton: {
    position: 'absolute',
    top: 40,
    right: 20,
    padding: 10,
    zIndex: 10,
  },
  settingsButtonText: {
    fontSize: 24,
  },
  settingsCard: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    marginBottom: 20,
  },
  settingsLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  settingsHint: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    lineHeight: 20,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 15,
    backgroundColor: '#f9f9f9',
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10,
  },
  testButton: {
    flex: 1,
    backgroundColor: '#2196F3',
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#4CAF50',
  },
  currentUrlText: {
    marginTop: 15,
    fontSize: 12,
    color: '#999',
    fontStyle: 'italic',
    textAlign: 'center',
  },
  apiUrlHint: {
    marginTop: 20,
    fontSize: 12,
    color: '#999',
    textAlign: 'center',
  },
  detectionBox: {
    backgroundColor: '#E8F5E9',
    padding: 30,
    borderRadius: 10,
    marginVertical: 20,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  detectionText: {
    marginTop: 15,
    fontSize: 16,
    fontWeight: '600',
    color: '#2E7D32',
    textAlign: 'center',
  },
  detectionSubtext: {
    marginTop: 8,
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  autoDetectButton: {
    backgroundColor: '#9C27B0',
    marginBottom: 15,
  },
  orText: {
    textAlign: 'center',
    color: '#999',
    marginVertical: 15,
    fontSize: 14,
  },
  settingsSubLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 10,
    color: '#555',
  },
  helpButton: {
    marginTop: 10,
    marginBottom: 10,
    padding: 10,
  },
  helpButtonText: {
    color: '#2196F3',
    fontSize: 14,
    fontWeight: '600',
  },
  instructionsBox: {
    backgroundColor: '#F0F8FF',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  instructionsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  instructionsText: {
    fontSize: 13,
    lineHeight: 20,
    color: '#555',
  },
  instructionsBold: {
    fontWeight: 'bold',
    color: '#333',
  },
  currentUrlBox: {
    marginTop: 15,
    padding: 12,
    backgroundColor: '#f0f0f0',
    borderRadius: 8,
  },
  currentUrlLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 5,
  },
  currentUrlText: {
    fontSize: 12,
    color: '#333',
    fontFamily: 'monospace',
  },
  tabContainer: {
    flexDirection: 'row',
    marginBottom: 20,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  tab: {
    flex: 1,
    padding: 15,
    alignItems: 'center',
    borderRadius: 8,
    backgroundColor: 'transparent',
  },
  tabActive: {
    backgroundColor: '#4CAF50',
  },
  tabText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: 'white',
    fontWeight: 'bold',
  },
  resultsContent: {
    flex: 1,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
    backgroundColor: 'white',
    borderRadius: 10,
    marginTop: 20,
  },
  emptyStateText: {
    fontSize: 16,
    color: '#999',
    fontStyle: 'italic',
  },
  scanningContainer: {
    flex: 1,
  },
  scanningContent: {
    padding: 20,
    alignItems: 'center',
  },
  scanningStatus: {
    backgroundColor: '#E8F5E9',
    padding: 15,
    borderRadius: 10,
    marginVertical: 20,
    width: '100%',
    alignItems: 'center',
  },
  scanningStatusText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#4CAF50',
  },
  scanningButtons: {
    width: '100%',
    gap: 15,
  },
  continueButton: {
    backgroundColor: '#2196F3',
  },
  finishButton: {
    backgroundColor: '#4CAF50',
  },
  doneButton: {
    marginTop: 10,
    paddingVertical: 18,
  },
  buttonSubtext: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
    fontWeight: 'normal',
  },
  previewBox: {
    marginTop: 30,
    padding: 15,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    width: '100%',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#666',
    marginBottom: 10,
  },
  previewText: {
    fontSize: 12,
    color: '#999',
    lineHeight: 18,
  },
});
