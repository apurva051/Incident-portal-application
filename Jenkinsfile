pipeline {
    agent any

    environment {
        AWS_REGION = 'ap-south-1'
        AWS_ACCOUNT_ID = '401780891012'
        ECR_REPOSITORY = 'incident-portal'
        IMAGE_TAG = "${BUILD_NUMBER}"
        ECR_REGISTRY = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"
    }

    stages {
        stage('Checkout'){
            checkout scm
        }

        stage ('Build Image'){
            steps {
                sh 'docker build -t ${ECR_REPOSITORY}:${IMAGE_TAG} '
            }
        }

        stage ('ECR Login'){
            steps {
                sh '''
                    aws ecr get-login-password --region ${AWS_REGION} |
                    docker login --username AWS --password-stdin ${ECR_REGISTRY}
                '''
            }
        }

        stage ('Push Image'){
            steps {
                sh '''
                    docker tag ${ECR_REPOSITORY}:${IMAGE_TAG} \
                    ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}

                    docker push \
                    ${ECR_REGISTRY}/${ECR_REPOSITORY}:${IMAGE_TAG}
                '''
            }
        }
    }
    post {
        success {
            echo 'Build and push to ECR successful!'
        }
        failure {
            echo 'Build or push to ECR failed.'
        }
    }
}
