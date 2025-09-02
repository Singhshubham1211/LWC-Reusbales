import { LightningElement,api,wire} from 'lwc';
// import apex method from salesforce module 
import getSalesUsers from '@salesforce/apex/IPT_ReusableUserLookup.getSalesUsers';

const DELAY = 300; // dealy apex callout timing in miliseconds  

export default class IptReusableUserLookup extends LightningElement {
    // public properties with initial default values 
        @api label = 'custom lookup label';
        @api placeholder = 'search...'; 
        @api iconName = 'standard:user';
        @api sObjectApiName = 'User';

        //@api defaultRecordId = '';
        @api required;
        @api isreadonly;

        @api oppId;
        // private properties 
        lstResult = []; // to store list of returned records   
        hasRecords = true; 
        searchKey=''; // to store input field value    
        isSearchLoading = false; // to control loading spinner  
        delayTimeout;
        selectedRecord = {}; // to store selected lookup record in object formate 
        
        /*@api parentInitialized = false;
    
    
       // initial function to populate default selected lookup record if defaultRecordId provided  
       renderedCallback() {
           
    }*/
    
        _defaultRecordId; //_defaultRecordId
    
        @api
        get defaultRecordId() {
            return this._defaultRecordId;
        }
    
        set defaultRecordId(newRecordId) {
            this._defaultRecordId = newRecordId;
            this.handleAccountIdChange(newRecordId);
        }
    
        handleAccountIdChange(newRecordId) {
            // Add your logic here that you want to run when the accountId is passed from the parent
            console.log('Account ID changed to:', newRecordId);
                console.log('Sold to party isreadonly'+this.isreadonly);
                console.log('#####defaultRecordId',newRecordId);
                //console.log(' @api ShipToPartyID', this.ShipToPartyID);
                if(newRecordId != ''){
                fetchDefaultRecord({ recordId: newRecordId , 'sObjectApiName' : this.sObjectApiName })
                .then((result) => {
                    if(result != null){
                        this.selectedRecord = result;
    
                        this.selectedRecord_id= result.Id;
                        console.log('soldtoparty'+JSON.stringify(this.selectedRecord));
                        console.log('soldtoparty'+JSON.stringify(this.selectedRecord_id));
                        this.handelSelectRecordHelper(); // helper function to show/hide lookup result container on UI
                        const oEvent = new CustomEvent('defaultvalueselected',
                        {
                            'detail': {selectedRecordid: this.selectedRecord_id}
                        }
                    );
                    this.dispatchEvent(oEvent);
                    }
                })
                .catch((error) => {
                    this.error = error;
                    this.selectedRecord = {};
                });
            }
        }
    
    
        // wire function property to fetch search record based on user input
        // @wire(fetchLookupData, { searchKey: '$searchKey' , sObjectApiName : '$sObjectApiName' })
        //  searchResult(value) {
        //     console.log('value = '+value);
        //     const { data, error } = value; // destructure the provisioned value
        //     this.isSearchLoading = false;
        //     if (data) {
        //          this.hasRecords = data.length == 0 ? false : true; 
        //          this.lstResult = JSON.parse(JSON.stringify(data)); 
        //      }
        //     else if (error) {
        //         console.log('(error---> ' + JSON.stringify(error));
        //      }
        // };
           
      // update searchKey property on input field change  
        handleKeyChange(event) {
            // Debouncing this method: Do not update the reactive property as long as this function is
            // being called within a delay of DELAY. This is to avoid a very large number of Apex method calls.
            this.isSearchLoading = true;
            window.clearTimeout(this.delayTimeout);
            const searchKey = event.target.value;
            
            this.delayTimeout = setTimeout(() => {
            this.searchKey = searchKey;
            }, DELAY);
    
            setTimeout(() => {
                
                    this.fetchData();
                
            }, DELAY+1);
        }
        
        fetchData(){
            console.log('in fetchData', this.searchKey, this.sObjectApiName);
            getSalesUsers({ searchKey: this.searchKey , sObjectApiName : this.sObjectApiName , oppId : this.oppId })
                .then(value => {
                    console.log('value = '+JSON.stringify(value,null,2));
                    // const { data, error } = value; // destructure the provisioned value
                    this.isSearchLoading = false;
                    if (value) {
                        this.hasRecords = value.length == 0 ? false : true; 
                        this.lstResult = JSON.parse(JSON.stringify(value)); 
                    }
                    // else if (error) {
                    //     console.log('(error---> ' + JSON.stringify(error));
                    // }
                })
                .catch(error => {
                    console.log('(error---> ' + JSON.stringify(error));
                });
        }
        
        
    
        // method to toggle lookup result section on UI 
        toggleResult(event){
            const lookupInputContainer = this.template.querySelector('.lookupInputContainer');
            const clsList = lookupInputContainer.classList;
            const whichEvent = event.target.getAttribute('data-source');
            switch(whichEvent) {
                case 'searchInputField':
                    clsList.add('slds-is-open');
                   break;
                case 'lookupContainer':
                    clsList.remove('slds-is-open');    
                break;                    
               }
        }
    
       // method to clear selected lookup record  
       handleRemove(){
        this.defaultRecordId='';
        this.searchKey = '';    
        this.selectedRecord = {};
        this.lookupUpdatehandler(undefined); // update value on parent component as well from helper function 
        
        // remove selected pill and display input field again 
        const searchBoxWrapper = this.template.querySelector('.searchBoxWrapper');
         searchBoxWrapper.classList.remove('slds-hide');
         searchBoxWrapper.classList.add('slds-show');
    
         const pillDiv = this.template.querySelector('.pillDiv');
         pillDiv.classList.remove('slds-show');
         pillDiv.classList.add('slds-hide');
      }
    
      // method to update selected record from search result 
    handelSelectedRecord(event){   
         var objId = event.target.getAttribute('data-recid'); // get selected record Id 
         this.selectedRecord = this.lstResult.find(data => data.Id === objId); // find selected record from list 
        // console.log('selectedRecord'+selectedRecord);
         this.lookupUpdatehandler(this.selectedRecord); // update value on parent component as well from helper function 
         this.handelSelectRecordHelper(); // helper function to show/hide lookup result container on UI
    }
    
    /*COMMON HELPER METHOD STARTED*/
    
    handelSelectRecordHelper(){
        this.template.querySelector('.lookupInputContainer').classList.remove('slds-is-open');
    
         const searchBoxWrapper = this.template.querySelector('.searchBoxWrapper');
         searchBoxWrapper.classList.remove('slds-show');
         searchBoxWrapper.classList.add('slds-hide');
    
         const pillDiv = this.template.querySelector('.pillDiv');
         pillDiv.classList.remove('slds-hide');
         pillDiv.classList.add('slds-show');     
    }
    
    // send selected lookup record to parent component using custom event
    lookupUpdatehandler(value){    
        const oEvent = new CustomEvent('lookupupdate',
        {
            'detail': {selectedRecord: value}
        }
    );
    this.dispatchEvent(oEvent);
    }
    defaultloadhandler(value){    
        const oEvent = new CustomEvent('loadlookup',
        {
            'detail': {selectedRecord: value}
        }
    );
    this.dispatchEvent(oEvent);
    }
    
    
    
    
}